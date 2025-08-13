import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { FileStewardAgent } from '../../agents/FileStewardAgent';
import { AgentOrchestrator } from '../../services/AgentOrchestrator';
import { CrossLayerEnforcementService } from '../../services/CrossLayerEnforcementService';
import { Neo4jService } from '../../services/Neo4jService';
import { PostgresService } from '../../services/PostgresService';
import { QueueService } from '../../services/queues/QueueService';
import { v4 as uuidv4 } from 'uuid';

/**
 * End-to-End Cluster Workflow Integration Tests
 * 
 * Tests the complete cluster-centric processing pipeline:
 * 1. File ingestion with cluster creation
 * 2. Multi-slot classification via EdgeFacts
 * 3. Content extraction triggering
 * 4. Cross-layer relationship establishment
 * 5. Event-driven agent orchestration
 * 6. Consistency validation and repair
 */
describe('Cluster Workflow Integration', () => {
  let neo4jService: Neo4jService;
  let postgresService: PostgresService;
  let queueService: QueueService;
  let fileStewardAgent: FileStewardAgent;
  let orchestrator: AgentOrchestrator;
  let crossLayerService: CrossLayerEnforcementService;
  
  const testOrgId = 'test-org-' + uuidv4();
  const testProjectId = 'test-project-' + uuidv4();
  const testSourceId = 'test-source-' + uuidv4();

  beforeAll(async () => {
    // Initialize services
    neo4jService = new Neo4jService();
    postgresService = new PostgresService();
    queueService = new QueueService();
    
    // Initialize agents and services
    fileStewardAgent = new FileStewardAgent(queueService);
    fileStewardAgent.enableClusterMode();
    orchestrator = new AgentOrchestrator(queueService, neo4jService, postgresService);
    crossLayerService = new CrossLayerEnforcementService(neo4jService, postgresService);
    
    // Setup test data
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  describe('File-to-Cluster Pipeline', () => {
    test('should create cluster for ingested file', async () => {
      const fileData = {
        orgId: testOrgId,
        sourceId: testSourceId,
        eventType: 'file_created' as const,
        resourcePath: '/test/script.fdx',
        eventData: {
          name: 'script.fdx',
          size: 1024000,
          mimeType: 'application/vnd.final-draft.fdx',
          checksum: 'abc123',
          modified: new Date().toISOString(),
          id: uuidv4(),
          provider: 'dropbox'
        }
      };

      const result = await fileStewardAgent.processSyncEventWithCluster(fileData);
      
      expect(result).toBeDefined();
      expect(result.clusterId).toBeDefined();
      expect(result.fileId).toBeDefined();
      expect(result.slots).toContain('SCRIPT_PRIMARY');
      expect(result.extractionTriggered).toBe(true);
    });

    test('should support multi-slot classification', async () => {
      const fileData = {
        orgId: testOrgId,
        sourceId: testSourceId,
        eventType: 'file_created' as const,
        resourcePath: '/test/combined-doc.pdf',
        eventData: {
          name: 'combined-doc.pdf',
          size: 2048000,
          mimeType: 'application/pdf',
          checksum: 'def456',
          modified: new Date().toISOString(),
          id: uuidv4(),
          provider: 'dropbox'
        }
      };

      const result = await fileStewardAgent.processSyncEventWithCluster(fileData);
      
      expect(result.slots.length).toBeGreaterThan(1);
      
      // Verify EdgeFacts were created for each slot
      const edgeFacts = await neo4jService.run(`
        MATCH (f:File {id: $fileId})<-[:FILLS_SLOT]-(ef:EdgeFact)
        RETURN ef.type as slotType, ef.props.confidence as confidence
      `, { fileId: result.fileId });
      
      expect(edgeFacts.records.length).toBe(result.slots.length);
    });
  });

  describe('Cross-Layer Relationship Enforcement', () => {
    test('should create cross-layer links automatically', async () => {
      // Create test entities
      const sceneId = await createTestScene();
      const shootDayId = await createTestShootDay();
      
      // Create cross-layer link
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
      
      expect(linkId).toBeDefined();
      
      // Verify link exists
      const linkExists = await neo4jService.run(`
        MATCH (s:Scene {id: $sceneId})-[:SCHEDULED_ON]->(sd:ShootDay {id: $shootDayId})
        RETURN count(*) as linkCount
      `, { sceneId, shootDayId });
      
      expect(linkExists.records[0].get('linkCount').toNumber()).toBe(1);
    });

    test('should validate and repair cross-layer consistency', async () => {
      // Create scene without required ShootDay link
      const orphanSceneId = await createTestScene({ status: 'scheduled' });
      
      // Run validation
      const validationResults = await crossLayerService.validateAllCrossLayerLinks(testOrgId);
      
      const sceneRule = validationResults.find(r => r.ruleId === 'scene-shootday-link');
      expect(sceneRule).toBeDefined();
      expect(sceneRule!.violationsFound).toBeGreaterThan(0);
      
      // Check if violations were repaired
      const repairedViolations = sceneRule!.violations.filter(v => v.repaired);
      expect(repairedViolations.length).toBeGreaterThan(0);
    });

    test('should maintain file-cluster relationship integrity', async () => {
      // Create file without cluster (violation)
      const orphanFileId = await createTestFile({ skipCluster: true });
      
      // Run validation
      const validationResults = await crossLayerService.validateAllCrossLayerLinks(testOrgId);
      
      const fileClusterRule = validationResults.find(r => r.ruleId === 'file-cluster-link');
      expect(fileClusterRule).toBeDefined();
      expect(fileClusterRule!.violationsFound).toBeGreaterThan(0);
      expect(fileClusterRule!.violationsRepaired).toBeGreaterThan(0);
      
      // Verify cluster was created
      const clusterExists = await neo4jService.run(`
        MATCH (f:File {id: $fileId})-[:HAS_CLUSTER]->(cc:ContentCluster)
        RETURN cc.id as clusterId
      `, { fileId: orphanFileId });
      
      expect(clusterExists.records.length).toBe(1);
    });
  });

  describe('Event-Driven Orchestration', () => {
    test('should trigger multi-agent workflow', async () => {
      const mockEvent = {
        type: 'file.processed',
        orgId: testOrgId,
        fileId: uuidv4(),
        clusterId: uuidv4(),
        slots: ['SCRIPT_PRIMARY'],
        extractionTriggered: true,
        eventType: 'created',
        timestamp: new Date().toISOString(),
        agent: 'enhanced-file-steward-agent'
      };

      const workflowId = await orchestrator.startWorkflow(
        orchestrator.getRegisteredWorkflows().find(w => w.id === 'file-to-cluster-workflow')!,
        mockEvent
      );
      
      expect(workflowId).toBeDefined();
      
      // Wait for workflow to process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const workflowStatus = orchestrator.getWorkflowStatus(workflowId);
      expect(workflowStatus).toBeDefined();
      expect(workflowStatus!.results.size).toBeGreaterThan(0);
    });

    test('should handle workflow step failures gracefully', async () => {
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

      const workflowId = await orchestrator.startWorkflow(
        orchestrator.getRegisteredWorkflows().find(w => w.id === 'file-to-cluster-workflow')!,
        mockEvent
      );
      
      // Wait for workflow to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const workflowStatus = orchestrator.getWorkflowStatus(workflowId);
      expect(workflowStatus).toBeDefined();
      expect(workflowStatus!.errors.size).toBeGreaterThan(0);
    });
  });

  describe('Performance and Statistics', () => {
    test('should provide cross-layer statistics', async () => {
      const stats = await crossLayerService.getCrossLayerStatistics(testOrgId);
      
      expect(stats).toBeDefined();
      expect(stats.totalFiles).toBeGreaterThan(0);
      expect(stats.clusterCoverage).toBeDefined();
      expect(stats.crossLayerLinks).toBeDefined();
      expect(Array.isArray(stats.crossLayerLinks)).toBe(true);
    });

    test('should handle large-scale validation efficiently', async () => {
      const startTime = Date.now();
      
      // Create multiple test entities
      const promises = Array.from({ length: 10 }, () => createTestScene());
      await Promise.all(promises);
      
      // Run validation
      const validationResults = await crossLayerService.validateAllCrossLayerLinks(testOrgId);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(validationResults.length).toBeGreaterThan(0);
    });
  });

  // Helper functions
  async function setupTestEnvironment(): Promise<void> {
    // Create test organization
    await neo4jService.run(`
      CREATE (o:Organization {
        id: $orgId,
        name: 'Test Organization',
        slug: 'test-org',
        createdAt: datetime()
      })
    `, { orgId: testOrgId });

    // Create test project
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

    // Create test source
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

    // Setup parser registry
    await postgresService.query(`
      INSERT INTO parser_registry (id, org_id, slot, mime_type, parser_name, parser_version, min_confidence, feature_flag, enabled)
      VALUES 
        ($2, $1, 'SCRIPT_PRIMARY', 'application/vnd.final-draft.fdx', 'fdx-parser', '1.0.0', 0.8, true, true),
        ($3, $1, 'SCRIPT_PRIMARY', 'application/pdf', 'pdf-script-parser', '1.0.0', 0.7, true, true),
        ($4, $1, 'BUDGET_MASTER', 'application/pdf', 'pdf-budget-parser', '1.0.0', 0.7, true, true)
    `, [testOrgId, 'test-parser-int-1', 'test-parser-int-2', 'test-parser-int-3']);
  }

  async function cleanupTestEnvironment(): Promise<void> {
    // Clean up Neo4j test data
    await neo4jService.run(`
      MATCH (n) WHERE n.orgId = $orgId OR n.org_id = $orgId
      DETACH DELETE n
    `, { orgId: testOrgId });

    // Clean up PostgreSQL test data
    await postgresService.query(`
      DELETE FROM parser_registry WHERE org_id = $1
    `, [testOrgId]);
    
    await postgresService.query(`
      DELETE FROM content_cluster WHERE org_id = $1
    `, [testOrgId]);
  }

  async function createTestScene(options: { status?: string } = {}): Promise<string> {
    const sceneId = uuidv4();
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

  async function createTestShootDay(): Promise<string> {
    const shootDayId = uuidv4();
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

  async function createTestFile(options: { skipCluster?: boolean } = {}): Promise<string> {
    const fileId = uuidv4();
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
      const clusterId = uuidv4();
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
