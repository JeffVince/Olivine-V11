"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const FileStewardAgent_1 = require("../../agents/FileStewardAgent");
const TaxonomyClassificationAgent_1 = require("../../agents/TaxonomyClassificationAgent");
const ProvenanceTrackingAgent_1 = require("../../agents/ProvenanceTrackingAgent");
const QueueService_1 = require("../../services/queues/QueueService");
const Neo4jService_1 = require("../../services/Neo4jService");
const PostgresService_1 = require("../../services/PostgresService");
const TaxonomyService_1 = require("../../services/TaxonomyService");
const ContentOntologyService_1 = require("../../services/ContentOntologyService");
const OperationsOntologyService_1 = require("../../services/OperationsOntologyService");
(0, globals_1.describe)('Enhanced Agent System Integration Tests', () => {
    let queueService;
    let neo4jService;
    let postgresService;
    let fileStewardAgent;
    let taxonomyAgent;
    let provenanceAgent;
    let taxonomyService;
    let contentService;
    let operationsService;
    const testOrgId = 'test-org-enhanced-agents';
    const testUserId = 'test-user-enhanced-agents';
    (0, globals_1.beforeAll)(async () => {
        queueService = new QueueService_1.QueueService();
        neo4jService = new Neo4jService_1.Neo4jService();
        postgresService = new PostgresService_1.PostgresService();
        taxonomyService = new TaxonomyService_1.TaxonomyService();
        contentService = new ContentOntologyService_1.ContentOntologyService();
        operationsService = new OperationsOntologyService_1.OperationsOntologyService();
        await queueService.connect();
        await neo4jService.connect();
        await postgresService.connect();
        fileStewardAgent = new FileStewardAgent_1.FileStewardAgent(queueService);
        taxonomyAgent = new TaxonomyClassificationAgent_1.TaxonomyClassificationAgent(queueService);
        provenanceAgent = new ProvenanceTrackingAgent_1.ProvenanceTrackingAgent(queueService);
        await fileStewardAgent.start();
        await taxonomyAgent.start();
        await provenanceAgent.start();
    });
    (0, globals_1.afterAll)(async () => {
        await fileStewardAgent.stop();
        await taxonomyAgent.stop();
        await provenanceAgent.stop();
        await queueService.close();
        await neo4jService.close();
        await postgresService.close();
    });
    (0, globals_1.beforeEach)(async () => {
        await neo4jService.run('MATCH (n {org_id: $orgId}) DETACH DELETE n', { orgId: testOrgId });
    });
    (0, globals_1.describe)('FileStewardAgent Integration', () => {
        (0, globals_1.it)('should process file creation events end-to-end', async () => {
            const testFileData = {
                orgId: testOrgId,
                sourceId: 'test-source',
                eventType: 'file_created',
                resourcePath: '/test-folder/test-script.pdf',
                eventData: {
                    entry: {
                        id: 'test-file-id',
                        name: 'test-script.pdf',
                        size: 1024000,
                        content_hash: 'abc123',
                        server_modified: new Date().toISOString(),
                        path_display: '/test-folder/test-script.pdf'
                    }
                }
            };
            await fileStewardAgent.processSyncEvent(testFileData);
            await new Promise(resolve => setTimeout(resolve, 2000));
            const result = await neo4jService.run('MATCH (f:File {org_id: $orgId, path: $path}) RETURN f', { orgId: testOrgId, path: '/test-folder/test-script.pdf' });
            (0, globals_1.expect)(result.records).toHaveLength(1);
            const file = result.records[0].get('f').properties;
            (0, globals_1.expect)(file.name).toBe('test-script.pdf');
            (0, globals_1.expect)(file.size.toNumber()).toBe(1024000);
        });
        (0, globals_1.it)('should create folder hierarchy correctly', async () => {
            const testFileData = {
                orgId: testOrgId,
                sourceId: 'test-source',
                eventType: 'file_created',
                resourcePath: '/projects/feature-film/scripts/draft-v1.pdf',
                eventData: {
                    entry: {
                        id: 'test-file-nested',
                        name: 'draft-v1.pdf',
                        size: 512000,
                        content_hash: 'def456',
                        server_modified: new Date().toISOString(),
                        path_display: '/projects/feature-film/scripts/draft-v1.pdf'
                    }
                }
            };
            await fileStewardAgent.processSyncEvent(testFileData);
            await new Promise(resolve => setTimeout(resolve, 1500));
            const folderResult = await neo4jService.run('MATCH (f:Folder {org_id: $orgId}) RETURN f.path as path ORDER BY f.path', { orgId: testOrgId });
            const folderPaths = folderResult.records.map((r) => r.get('path'));
            (0, globals_1.expect)(folderPaths).toContain('/projects');
            (0, globals_1.expect)(folderPaths).toContain('/projects/feature-film');
            (0, globals_1.expect)(folderPaths).toContain('/projects/feature-film/scripts');
        });
    });
    (0, globals_1.describe)('TaxonomyClassificationAgent Integration', () => {
        (0, globals_1.it)('should classify files using taxonomy rules', async () => {
            const fileId = await createTestFile();
            await taxonomyService.createCanonicalSlot({
                org_id: testOrgId,
                description: 'Test Script Slot',
                category: 'script',
                required: true,
                multiple: false,
                validation_rules: {
                    mime_types: ['application/pdf'],
                    naming_pattern: '.*script.*'
                }
            }, testOrgId);
            const profile = await taxonomyService.createTaxonomyProfile({
                org_id: testOrgId,
                name: 'Test Profile',
                description: 'Test classification profile',
                active: true,
                priority: 1,
                metadata: {}
            }, testOrgId);
            const classificationData = {
                orgId: testOrgId,
                fileId,
                filePath: '/test-script.pdf',
                metadata: {
                    name: 'test-script.pdf',
                    mimeType: 'application/pdf',
                    size: 1024000
                }
            };
            const result = await taxonomyAgent.classifyFile(classificationData);
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(result.slotKey).toBeDefined();
            (0, globals_1.expect)(result.confidence).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should apply classification as EdgeFact', async () => {
            const fileId = await createTestFile();
            const classification = {
                slot: 'TEST_SCRIPT_SLOT',
                confidence: 0.9,
                method: 'rule_based',
                rule_id: 'test-rule'
            };
            await taxonomyService.applyClassification(fileId, classification, testOrgId, testUserId);
            const result = await neo4jService.run(`
        MATCH (f:File {id: $fileId})<-[:FROM]-(ef:EdgeFact {type: 'CLASSIFIED_AS', valid_to: null})
        RETURN ef
      `, { fileId });
            (0, globals_1.expect)(result.records).toHaveLength(1);
            const edgeFact = result.records[0].get('ef').properties;
            (0, globals_1.expect)(edgeFact.confidence).toBe(0.9);
        });
    });
    (0, globals_1.describe)('ProvenanceTrackingAgent Integration', () => {
        (0, globals_1.it)('should create commits with cryptographic signatures', async () => {
            const commitData = {
                orgId: testOrgId,
                message: 'Test commit for integration',
                author: testUserId,
                authorType: 'user',
                metadata: { test: true }
            };
            const commitId = await provenanceAgent.processCreateCommit(commitData);
            (0, globals_1.expect)(commitId).toBeDefined();
            const result = await neo4jService.run('MATCH (c:Commit {id: $commitId}) RETURN c', { commitId });
            (0, globals_1.expect)(result.records).toHaveLength(1);
            const commit = result.records[0].get('c').properties;
            (0, globals_1.expect)(commit.message).toBe('Test commit for integration');
            (0, globals_1.expect)(commit.signature).toBeDefined();
        });
        (0, globals_1.it)('should validate commit integrity', async () => {
            const commitData = {
                orgId: testOrgId,
                message: 'Test validation commit',
                author: testUserId,
                authorType: 'user'
            };
            const commitId = await provenanceAgent.processCreateCommit(commitData);
            const isValid = await provenanceAgent.validateCommit(commitId);
            (0, globals_1.expect)(isValid).toBe(true);
        });
        (0, globals_1.it)('should create action records linked to commits', async () => {
            const commitData = {
                orgId: testOrgId,
                message: 'Test commit with action',
                author: testUserId,
                authorType: 'user'
            };
            const commitId = await provenanceAgent.processCreateCommit(commitData);
            const actionData = {
                commitId,
                orgId: testOrgId,
                action: {
                    actionType: 'TEST_ACTION',
                    tool: 'integration-test',
                    entityType: 'File',
                    entityId: 'test-entity',
                    inputs: { test: 'input' },
                    outputs: { test: 'output' },
                    status: 'success'
                }
            };
            const actionId = await provenanceAgent.processCreateAction(actionData);
            (0, globals_1.expect)(actionId).toBeDefined();
            const result = await neo4jService.run(`
        MATCH (c:Commit {id: $commitId})-[:CONTAINS]->(a:Action {id: $actionId})
        RETURN c, a
      `, { commitId, actionId });
            (0, globals_1.expect)(result.records).toHaveLength(1);
        });
    });
    (0, globals_1.describe)('Content Ontology Service Integration', () => {
        (0, globals_1.it)('should create project with provenance tracking', async () => {
            const projectData = {
                org_id: testOrgId,
                title: 'Test Feature Film',
                type: 'feature_film',
                status: 'development',
                budget: 1000000,
                metadata: { genre: 'Drama' }
            };
            const project = await contentService.createProject(projectData, testUserId);
            (0, globals_1.expect)(project).toBeDefined();
            (0, globals_1.expect)(project.title).toBe('Test Feature Film');
            const commitResult = await neo4jService.run(`
        MATCH (c:Commit {org_id: $orgId})
        WHERE c.message CONTAINS "Created project"
        RETURN c
      `, { orgId: testOrgId });
            (0, globals_1.expect)(commitResult.records.length).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should create scene and link to character with EdgeFacts', async () => {
            const project = await contentService.createProject({
                org_id: testOrgId,
                title: 'Test Project',
                type: 'feature_film',
                status: 'development'
            }, testUserId);
            const scene = await contentService.createScene({
                org_id: testOrgId,
                project_id: project.id,
                number: '1A',
                title: 'Opening Scene',
                status: 'draft'
            }, testUserId);
            const character = await contentService.createCharacter({
                org_id: testOrgId,
                project_id: project.id,
                name: 'John Doe',
                role_type: 'lead'
            }, testUserId);
            await contentService.linkSceneToCharacter(scene.id, character.id, testOrgId, testUserId);
            const result = await neo4jService.run(`
        MATCH (s:Scene {id: $sceneId})<-[:FROM]-(ef:EdgeFact {type: 'FEATURES_CHARACTER'})-[:TO]->(c:Character {id: $characterId})
        RETURN ef
      `, { sceneId: scene.id, characterId: character.id });
            (0, globals_1.expect)(result.records).toHaveLength(1);
        });
    });
    (0, globals_1.describe)('Operations Ontology Service Integration', () => {
        (0, globals_1.it)('should create vendor with provenance', async () => {
            const vendorData = {
                org_id: testOrgId,
                name: 'Test Equipment Rental',
                category: 'equipment',
                contact_email: 'contact@testequipment.com',
                status: 'active',
                rating: 4.5
            };
            const vendor = await operationsService.createVendor(vendorData, testUserId);
            (0, globals_1.expect)(vendor).toBeDefined();
            (0, globals_1.expect)(vendor.name).toBe('Test Equipment Rental');
            const commitResult = await neo4jService.run(`
        MATCH (c:Commit {org_id: $orgId})
        WHERE c.message CONTAINS "Created vendor"
        RETURN c
      `, { orgId: testOrgId });
            (0, globals_1.expect)(commitResult.records.length).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should create purchase order linked to vendor', async () => {
            const vendor = await operationsService.createVendor({
                org_id: testOrgId,
                name: 'Camera Rental Co',
                category: 'equipment',
                status: 'active'
            }, testUserId);
            const project = await contentService.createProject({
                org_id: testOrgId,
                title: 'Test Project for PO',
                type: 'feature_film',
                status: 'development'
            }, testUserId);
            const poData = {
                org_id: testOrgId,
                project_id: project.id,
                po_number: 'PO-2024-001',
                vendor_id: vendor.id,
                description: 'Camera equipment rental',
                amount: 5000,
                currency: 'USD',
                status: 'draft',
                order_date: new Date(),
                created_by: testUserId
            };
            const po = await operationsService.createPurchaseOrder(poData, testUserId);
            (0, globals_1.expect)(po).toBeDefined();
            (0, globals_1.expect)(po.po_number).toBe('PO-2024-001');
            const result = await neo4jService.run(`
        MATCH (po:PurchaseOrder {id: $poId})-[:FROM_VENDOR]->(v:Vendor {id: $vendorId})
        RETURN po, v
      `, { poId: po.id, vendorId: vendor.id });
            (0, globals_1.expect)(result.records).toHaveLength(1);
        });
    });
    async function createTestFile() {
        const fileQuery = `
      CREATE (f:File {
        id: randomUUID(),
        org_id: $orgId,
        source_id: 'test-source',
        name: 'test-script.pdf',
        path: '/test-script.pdf',
        size: 1024000,
        mime_type: 'application/pdf',
        current: true,
        deleted: false,
        created_at: datetime()
      })
      RETURN f.id as fileId
    `;
        const result = await neo4jService.run(fileQuery, { orgId: testOrgId });
        return result.records[0].get('fileId');
    }
});
//# sourceMappingURL=EnhancedAgentSystem.test.js.map