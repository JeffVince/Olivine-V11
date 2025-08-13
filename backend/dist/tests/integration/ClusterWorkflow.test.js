"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const FileStewardAgent_1 = require("../../agents/FileStewardAgent");
const AgentOrchestrator_1 = require("../../services/AgentOrchestrator");
const CrossLayerEnforcementService_1 = require("../../services/CrossLayerEnforcementService");
const Neo4jService_1 = require("../../services/Neo4jService");
const PostgresService_1 = require("../../services/PostgresService");
const QueueService_1 = require("../../services/queues/QueueService");
const uuid_1 = require("uuid");
(0, globals_1.describe)('Cluster Workflow Integration', () => {
    let neo4jService;
    let postgresService;
    let queueService;
    let fileStewardAgent;
    let orchestrator;
    let crossLayerService;
    const testOrgId = 'test-org-' + (0, uuid_1.v4)();
    const testProjectId = 'test-project-' + (0, uuid_1.v4)();
    const testSourceId = 'test-source-' + (0, uuid_1.v4)();
    (0, globals_1.beforeAll)(async () => {
        neo4jService = new Neo4jService_1.Neo4jService();
        postgresService = new PostgresService_1.PostgresService();
        queueService = new QueueService_1.QueueService();
        fileStewardAgent = new FileStewardAgent_1.FileStewardAgent(queueService);
        fileStewardAgent.enableClusterMode();
        orchestrator = new AgentOrchestrator_1.AgentOrchestrator(queueService, neo4jService, postgresService);
        crossLayerService = new CrossLayerEnforcementService_1.CrossLayerEnforcementService(neo4jService, postgresService);
        await setupTestEnvironment();
    });
    (0, globals_1.afterAll)(async () => {
        await cleanupTestEnvironment();
    });
    (0, globals_1.describe)('File-to-Cluster Pipeline', () => {
        (0, globals_1.test)('should create cluster for ingested file', async () => {
            const fileData = {
                orgId: testOrgId,
                sourceId: testSourceId,
                eventType: 'file_created',
                resourcePath: '/test/script.fdx',
                eventData: {
                    name: 'script.fdx',
                    size: 1024000,
                    mimeType: 'application/vnd.final-draft.fdx',
                    checksum: 'abc123',
                    modified: new Date().toISOString(),
                    id: (0, uuid_1.v4)(),
                    provider: 'dropbox'
                }
            };
            const result = await fileStewardAgent.processSyncEventWithCluster(fileData);
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(result.clusterId).toBeDefined();
            (0, globals_1.expect)(result.fileId).toBeDefined();
            (0, globals_1.expect)(result.slots).toContain('SCRIPT_PRIMARY');
            (0, globals_1.expect)(result.extractionTriggered).toBe(true);
        });
        (0, globals_1.test)('should support multi-slot classification', async () => {
            const fileData = {
                orgId: testOrgId,
                sourceId: testSourceId,
                eventType: 'file_created',
                resourcePath: '/test/combined-doc.pdf',
                eventData: {
                    name: 'combined-doc.pdf',
                    size: 2048000,
                    mimeType: 'application/pdf',
                    checksum: 'def456',
                    modified: new Date().toISOString(),
                    id: (0, uuid_1.v4)(),
                    provider: 'dropbox'
                }
            };
            const result = await fileStewardAgent.processSyncEventWithCluster(fileData);
            (0, globals_1.expect)(result.slots.length).toBeGreaterThan(1);
            const edgeFacts = await neo4jService.run(`
        MATCH (f:File {id: $fileId})<-[:FILLS_SLOT]-(ef:EdgeFact)
        RETURN ef.type as slotType, ef.props.confidence as confidence
      `, { fileId: result.fileId });
            (0, globals_1.expect)(edgeFacts.records.length).toBe(result.slots.length);
        });
    });
    (0, globals_1.describe)('Cross-Layer Relationship Enforcement', () => {
        (0, globals_1.test)('should create cross-layer links automatically', async () => {
            const sceneId = await createTestScene();
            const shootDayId = await createTestShootDay();
            const linkId = await crossLayerService.createCrossLayerLink(testOrgId, {
                fromEntityId: sceneId,
                fromEntityType: 'Scene',
                fromLayer: 'Idea',
                toEntityId: shootDayId,
                toEntityType: 'ShootDay',
                toLayer: 'IRL',
                relationshipType: 'SCHEDULED_ON',
                method: 'automatic',
                createdBy: 'test-system'
            });
            (0, globals_1.expect)(linkId).toBeDefined();
            const linkExists = await neo4jService.run(`
        MATCH (s:Scene {id: $sceneId})-[:SCHEDULED_ON]->(sd:ShootDay {id: $shootDayId})
        RETURN count(*) as linkCount
      `, { sceneId, shootDayId });
            (0, globals_1.expect)(linkExists.records[0].get('linkCount').toNumber()).toBe(1);
        });
        (0, globals_1.test)('should validate and repair cross-layer consistency', async () => {
            const orphanSceneId = await createTestScene({ status: 'scheduled' });
            const validationResults = await crossLayerService.validateAllCrossLayerLinks(testOrgId);
            const sceneRule = validationResults.find(r => r.ruleId === 'scene-shootday-link');
            (0, globals_1.expect)(sceneRule).toBeDefined();
            (0, globals_1.expect)(sceneRule.violationsFound).toBeGreaterThan(0);
            const repairedViolations = sceneRule.violations.filter(v => v.repaired);
            (0, globals_1.expect)(repairedViolations.length).toBeGreaterThan(0);
        });
        (0, globals_1.test)('should maintain file-cluster relationship integrity', async () => {
            const orphanFileId = await createTestFile({ skipCluster: true });
            const validationResults = await crossLayerService.validateAllCrossLayerLinks(testOrgId);
            const fileClusterRule = validationResults.find(r => r.ruleId === 'file-cluster-link');
            (0, globals_1.expect)(fileClusterRule).toBeDefined();
            (0, globals_1.expect)(fileClusterRule.violationsFound).toBeGreaterThan(0);
            (0, globals_1.expect)(fileClusterRule.violationsRepaired).toBeGreaterThan(0);
            const clusterExists = await neo4jService.run(`
        MATCH (f:File {id: $fileId})-[:HAS_CLUSTER]->(cc:ContentCluster)
        RETURN cc.id as clusterId
      `, { fileId: orphanFileId });
            (0, globals_1.expect)(clusterExists.records.length).toBe(1);
        });
    });
    (0, globals_1.describe)('Event-Driven Orchestration', () => {
        (0, globals_1.test)('should trigger multi-agent workflow', async () => {
            const mockEvent = {
                type: 'file.processed',
                orgId: testOrgId,
                fileId: (0, uuid_1.v4)(),
                clusterId: (0, uuid_1.v4)(),
                slots: ['SCRIPT_PRIMARY'],
                extractionTriggered: true,
                eventType: 'created',
                timestamp: new Date().toISOString(),
                agent: 'enhanced-file-steward-agent'
            };
            const workflowId = await orchestrator.startWorkflow(orchestrator.getRegisteredWorkflows().find(w => w.id === 'file-to-cluster-workflow'), mockEvent);
            (0, globals_1.expect)(workflowId).toBeDefined();
            await new Promise(resolve => setTimeout(resolve, 1000));
            const workflowStatus = orchestrator.getWorkflowStatus(workflowId);
            (0, globals_1.expect)(workflowStatus).toBeDefined();
            (0, globals_1.expect)(workflowStatus.results.size).toBeGreaterThan(0);
        });
        (0, globals_1.test)('should handle workflow step failures gracefully', async () => {
            const mockEvent = {
                type: 'file.processed',
                orgId: testOrgId,
                fileId: 'invalid-file-id',
                clusterId: 'invalid-cluster-id',
                slots: ['INVALID_SLOT'],
                extractionTriggered: true,
                eventType: 'created',
                timestamp: new Date().toISOString(),
                agent: 'enhanced-file-steward-agent'
            };
            const workflowId = await orchestrator.startWorkflow(orchestrator.getRegisteredWorkflows().find(w => w.id === 'file-to-cluster-workflow'), mockEvent);
            await new Promise(resolve => setTimeout(resolve, 2000));
            const workflowStatus = orchestrator.getWorkflowStatus(workflowId);
            (0, globals_1.expect)(workflowStatus).toBeDefined();
            (0, globals_1.expect)(workflowStatus.errors.size).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('Performance and Statistics', () => {
        (0, globals_1.test)('should provide cross-layer statistics', async () => {
            const stats = await crossLayerService.getCrossLayerStatistics(testOrgId);
            (0, globals_1.expect)(stats).toBeDefined();
            (0, globals_1.expect)(stats.totalFiles).toBeGreaterThan(0);
            (0, globals_1.expect)(stats.clusterCoverage).toBeDefined();
            (0, globals_1.expect)(stats.crossLayerLinks).toBeDefined();
            (0, globals_1.expect)(Array.isArray(stats.crossLayerLinks)).toBe(true);
        });
        (0, globals_1.test)('should handle large-scale validation efficiently', async () => {
            const startTime = Date.now();
            const promises = Array.from({ length: 10 }, () => createTestScene());
            await Promise.all(promises);
            const validationResults = await crossLayerService.validateAllCrossLayerLinks(testOrgId);
            const endTime = Date.now();
            const duration = endTime - startTime;
            (0, globals_1.expect)(duration).toBeLessThan(10000);
            (0, globals_1.expect)(validationResults.length).toBeGreaterThan(0);
        });
    });
    async function setupTestEnvironment() {
        await neo4jService.run(`
      CREATE (o:Organization {
        id: $orgId,
        name: 'Test Organization',
        slug: 'test-org',
        createdAt: datetime()
      })
    `, { orgId: testOrgId });
        await neo4jService.run(`
      MATCH (o:Organization {id: $orgId})
      CREATE (p:Project {
        id: $projectId,
        orgId: $orgId,
        name: 'Test Project',
        status: 'ACTIVE',
        createdAt: datetime()
      })
      CREATE (o)-[:HAS_PROJECT]->(p)
    `, { orgId: testOrgId, projectId: testProjectId });
        await neo4jService.run(`
      MATCH (o:Organization {id: $orgId})
      CREATE (s:Source {
        id: $sourceId,
        orgId: $orgId,
        name: 'Test Source',
        provider: 'dropbox',
        status: 'active',
        createdAt: datetime()
      })
      CREATE (o)-[:HAS_SOURCE]->(s)
    `, { orgId: testOrgId, sourceId: testSourceId });
        await postgresService.query(`
      INSERT INTO parser_registry (id, org_id, slot, mime_type, parser_name, parser_version, min_confidence, feature_flag, enabled)
      VALUES 
        ($2, $1, 'SCRIPT_PRIMARY', 'application/vnd.final-draft.fdx', 'fdx-parser', '1.0.0', 0.8, true, true),
        ($3, $1, 'SCRIPT_PRIMARY', 'application/pdf', 'pdf-script-parser', '1.0.0', 0.7, true, true),
        ($4, $1, 'BUDGET_MASTER', 'application/pdf', 'pdf-budget-parser', '1.0.0', 0.7, true, true)
    `, [testOrgId, 'test-parser-int-1', 'test-parser-int-2', 'test-parser-int-3']);
    }
    async function cleanupTestEnvironment() {
        await neo4jService.run(`
      MATCH (n) WHERE n.orgId = $orgId OR n.org_id = $orgId
      DETACH DELETE n
    `, { orgId: testOrgId });
        await postgresService.query(`
      DELETE FROM parser_registry WHERE org_id = $1
    `, [testOrgId]);
        await postgresService.query(`
      DELETE FROM content_cluster WHERE org_id = $1
    `, [testOrgId]);
    }
    async function createTestScene(options = {}) {
        const sceneId = (0, uuid_1.v4)();
        await neo4jService.run(`
      CREATE (s:Scene {
        id: $sceneId,
        org_id: $orgId,
        project_id: $projectId,
        number: $number,
        title: 'Test Scene',
        status: $status,
        createdAt: datetime()
      })
      RETURN s.id as sceneId
    `, {
            sceneId,
            orgId: testOrgId,
            projectId: testProjectId,
            number: Math.floor(Math.random() * 100).toString(),
            status: options.status || 'draft'
        });
        return sceneId;
    }
    async function createTestShootDay() {
        const shootDayId = (0, uuid_1.v4)();
        await neo4jService.run(`
      CREATE (sd:ShootDay {
        id: $shootDayId,
        org_id: $orgId,
        project_id: $projectId,
        date: datetime(),
        status: 'planned',
        createdAt: datetime()
      })
      RETURN sd.id as shootDayId
    `, {
            shootDayId,
            orgId: testOrgId,
            projectId: testProjectId
        });
        return shootDayId;
    }
    async function createTestFile(options = {}) {
        const fileId = (0, uuid_1.v4)();
        await neo4jService.run(`
      CREATE (f:File {
        id: $fileId,
        orgId: $orgId,
        sourceId: $sourceId,
        projectId: $projectId,
        path: '/test/file.txt',
        name: 'test-file.txt',
        mimeType: 'text/plain',
        current: true,
        deleted: false,
        createdAt: datetime()
      })
      RETURN f.id as fileId
    `, {
            fileId,
            orgId: testOrgId,
            sourceId: testSourceId,
            projectId: testProjectId
        });
        if (!options.skipCluster) {
            const clusterId = (0, uuid_1.v4)();
            await neo4jService.run(`
        MATCH (f:File {id: $fileId})
        CREATE (cc:ContentCluster {
          id: $clusterId,
          orgId: $orgId,
          fileId: $fileId,
          projectId: $projectId,
          status: 'empty',
          entitiesCount: 0,
          linksCount: 0,
          createdAt: datetime()
        })
        CREATE (f)-[:HAS_CLUSTER]->(cc)
      `, { fileId, clusterId, orgId: testOrgId, projectId: testProjectId });
        }
        return fileId;
    }
});
//# sourceMappingURL=ClusterWorkflow.test.js.map