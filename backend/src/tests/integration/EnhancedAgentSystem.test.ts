import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { FileStewardAgent } from '../../agents/FileStewardAgent';
import { TaxonomyClassificationAgent } from '../../agents/TaxonomyClassificationAgent';
import { ProvenanceTrackingAgent } from '../../agents/ProvenanceTrackingAgent';
import { QueueService } from '../../services/queues/QueueService';
import { Neo4jService } from '../../services/Neo4jService';
import { PostgresService } from '../../services/PostgresService';
import { TaxonomyService } from '../../services/TaxonomyService';
import { ContentOntologyService } from '../../services/ContentOntologyService';
import { OperationsOntologyService } from '../../services/OperationsOntologyService';

describe('Enhanced Agent System Integration Tests', () => {
  let queueService: QueueService;
  let neo4jService: Neo4jService;
  let postgresService: PostgresService;
  let fileStewardAgent: FileStewardAgent;
  let taxonomyAgent: TaxonomyClassificationAgent;
  let provenanceAgent: ProvenanceTrackingAgent;
  let taxonomyService: TaxonomyService;
  let contentService: ContentOntologyService;
  let operationsService: OperationsOntologyService;

  const testOrgId = 'test-org-enhanced-agents';
  const testUserId = 'test-user-enhanced-agents';

  beforeAll(async () => {
    // Initialize services
    queueService = new QueueService();
    neo4jService = new Neo4jService();
    postgresService = new PostgresService();
    taxonomyService = new TaxonomyService();
    contentService = new ContentOntologyService();
    operationsService = new OperationsOntologyService();

    // Connect services
    await queueService.connect();
    await neo4jService.connect();
    await postgresService.connect();

    // Initialize agents
    fileStewardAgent = new FileStewardAgent(queueService);
    taxonomyAgent = new TaxonomyClassificationAgent(queueService);
    provenanceAgent = new ProvenanceTrackingAgent(queueService);

    // Start agents
    await fileStewardAgent.start();
    await taxonomyAgent.start();
    await provenanceAgent.start();
  });

  afterAll(async () => {
    // Stop agents
    await fileStewardAgent.stop();
    await taxonomyAgent.stop();
    await provenanceAgent.stop();

    // Close service connections
    await queueService.close();
    await neo4jService.close();
    await postgresService.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await neo4jService.run(
      'MATCH (n {org_id: $orgId}) DETACH DELETE n',
      { orgId: testOrgId }
    );
  });

  describe('FileStewardAgent Integration', () => {
    it('should process file creation events end-to-end', async () => {
      const testFileData = {
        orgId: testOrgId,
        sourceId: 'test-source',
        eventType: 'file_created' as const,
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

      // Process the sync event
      await fileStewardAgent.processSyncEvent(testFileData);

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify file was created in Neo4j
      const result = await neo4jService.run(
        'MATCH (f:File {org_id: $orgId, path: $path}) RETURN f',
        { orgId: testOrgId, path: '/test-folder/test-script.pdf' }
      );

      expect(result.records).toHaveLength(1);
      const file = result.records[0].get('f').properties;
      expect(file.name).toBe('test-script.pdf');
      expect(file.size.toNumber()).toBe(1024000);
    });

    it('should create folder hierarchy correctly', async () => {
      const testFileData = {
        orgId: testOrgId,
        sourceId: 'test-source',
        eventType: 'file_created' as const,
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

      // Check folder hierarchy was created
      const folderResult = await neo4jService.run(
        'MATCH (f:Folder {org_id: $orgId}) RETURN f.path as path ORDER BY f.path',
        { orgId: testOrgId }
      );

      const folderPaths = folderResult.records.map(r => r.get('path'));
      expect(folderPaths).toContain('/projects');
      expect(folderPaths).toContain('/projects/feature-film');
      expect(folderPaths).toContain('/projects/feature-film/scripts');
    });
  });

  describe('TaxonomyClassificationAgent Integration', () => {
    it('should classify files using taxonomy rules', async () => {
      // First create a file
      const fileId = await createTestFile();

      // Create a taxonomy rule for script files
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

      // Process classification
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

      expect(result).toBeDefined();
      expect(result.slotKey).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should apply classification as EdgeFact', async () => {
      const fileId = await createTestFile();

      const classification = {
        slot: 'TEST_SCRIPT_SLOT',
        confidence: 0.9,
        method: 'rule_based' as const,
        rule_id: 'test-rule'
      };

      await taxonomyService.applyClassification(fileId, classification, testOrgId, testUserId);

      // Verify EdgeFact was created
      const result = await neo4jService.run(`
        MATCH (f:File {id: $fileId})<-[:FROM]-(ef:EdgeFact {type: 'CLASSIFIED_AS', valid_to: null})
        RETURN ef
      `, { fileId });

      expect(result.records).toHaveLength(1);
      const edgeFact = result.records[0].get('ef').properties;
      expect(edgeFact.confidence).toBe(0.9);
    });
  });

  describe('ProvenanceTrackingAgent Integration', () => {
    it('should create commits with cryptographic signatures', async () => {
      const commitData = {
        orgId: testOrgId,
        message: 'Test commit for integration',
        author: testUserId,
        authorType: 'user' as const,
        metadata: { test: true }
      };

      const commitId = await provenanceAgent.processCreateCommit(commitData);

      expect(commitId).toBeDefined();

      // Verify commit was created with signature
      const result = await neo4jService.run(
        'MATCH (c:Commit {id: $commitId}) RETURN c',
        { commitId }
      );

      expect(result.records).toHaveLength(1);
      const commit = result.records[0].get('c').properties;
      expect(commit.message).toBe('Test commit for integration');
      expect(commit.signature).toBeDefined();
    });

    it('should validate commit integrity', async () => {
      const commitData = {
        orgId: testOrgId,
        message: 'Test validation commit',
        author: testUserId,
        authorType: 'user' as const
      };

      const commitId = await provenanceAgent.processCreateCommit(commitData);
      const isValid = await provenanceAgent.validateCommit(commitId);

      expect(isValid).toBe(true);
    });

    it('should create action records linked to commits', async () => {
      const commitData = {
        orgId: testOrgId,
        message: 'Test commit with action',
        author: testUserId,
        authorType: 'user' as const
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
          status: 'success' as const
        }
      };

      const actionId = await provenanceAgent.processCreateAction(actionData);

      expect(actionId).toBeDefined();

      // Verify action is linked to commit
      const result = await neo4jService.run(`
        MATCH (c:Commit {id: $commitId})-[:CONTAINS]->(a:Action {id: $actionId})
        RETURN c, a
      `, { commitId, actionId });

      expect(result.records).toHaveLength(1);
    });
  });

  describe('Content Ontology Service Integration', () => {
    it('should create project with provenance tracking', async () => {
      const projectData = {
        org_id: testOrgId,
        title: 'Test Feature Film',
        type: 'feature_film' as const,
        status: 'development' as const,
        budget: 1000000,
        metadata: { genre: 'Drama' }
      };

      const project = await contentService.createProject(projectData, testUserId);

      expect(project).toBeDefined();
      expect(project.title).toBe('Test Feature Film');

      // Verify commit was created for provenance
      const commitResult = await neo4jService.run(`
        MATCH (c:Commit {org_id: $orgId})
        WHERE c.message CONTAINS "Created project"
        RETURN c
      `, { orgId: testOrgId });

      expect(commitResult.records.length).toBeGreaterThan(0);
    });

    it('should create scene and link to character with EdgeFacts', async () => {
      // Create project first
      const project = await contentService.createProject({
        org_id: testOrgId,
        title: 'Test Project',
        type: 'feature_film' as const,
        status: 'development' as const
      }, testUserId);

      // Create scene
      const scene = await contentService.createScene({
        org_id: testOrgId,
        project_id: project.id,
        number: '1A',
        title: 'Opening Scene',
        status: 'draft' as const
      }, testUserId);

      // Create character
      const character = await contentService.createCharacter({
        org_id: testOrgId,
        project_id: project.id,
        name: 'John Doe',
        role_type: 'lead' as const
      }, testUserId);

      // Link scene to character
      await contentService.linkSceneToCharacter(scene.id, character.id, testOrgId, testUserId);

      // Verify EdgeFact relationship was created
      const result = await neo4jService.run(`
        MATCH (s:Scene {id: $sceneId})<-[:FROM]-(ef:EdgeFact {type: 'FEATURES_CHARACTER'})-[:TO]->(c:Character {id: $characterId})
        RETURN ef
      `, { sceneId: scene.id, characterId: character.id });

      expect(result.records).toHaveLength(1);
    });
  });

  describe('Operations Ontology Service Integration', () => {
    it('should create vendor with provenance', async () => {
      const vendorData = {
        org_id: testOrgId,
        name: 'Test Equipment Rental',
        category: 'equipment',
        contact_email: 'contact@testequipment.com',
        status: 'active' as const,
        rating: 4.5
      };

      const vendor = await operationsService.createVendor(vendorData, testUserId);

      expect(vendor).toBeDefined();
      expect(vendor.name).toBe('Test Equipment Rental');

      // Verify provenance commit
      const commitResult = await neo4jService.run(`
        MATCH (c:Commit {org_id: $orgId})
        WHERE c.message CONTAINS "Created vendor"
        RETURN c
      `, { orgId: testOrgId });

      expect(commitResult.records.length).toBeGreaterThan(0);
    });

    it('should create purchase order linked to vendor', async () => {
      // Create vendor first
      const vendor = await operationsService.createVendor({
        org_id: testOrgId,
        name: 'Camera Rental Co',
        category: 'equipment',
        status: 'active' as const
      }, testUserId);

      // Create project for PO
      const project = await contentService.createProject({
        org_id: testOrgId,
        title: 'Test Project for PO',
        type: 'feature_film' as const,
        status: 'development' as const
      }, testUserId);

      // Create purchase order
      const poData = {
        org_id: testOrgId,
        project_id: project.id,
        po_number: 'PO-2024-001',
        vendor_id: vendor.id,
        description: 'Camera equipment rental',
        amount: 5000,
        currency: 'USD',
        status: 'draft' as const,
        order_date: new Date(),
        created_by: testUserId
      };

      const po = await operationsService.createPurchaseOrder(poData, testUserId);

      expect(po).toBeDefined();
      expect(po.po_number).toBe('PO-2024-001');

      // Verify vendor relationship
      const result = await neo4jService.run(`
        MATCH (po:PurchaseOrder {id: $poId})-[:FROM_VENDOR]->(v:Vendor {id: $vendorId})
        RETURN po, v
      `, { poId: po.id, vendorId: vendor.id });

      expect(result.records).toHaveLength(1);
    });
  });

  // Helper function to create a test file
  async function createTestFile(): Promise<string> {
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
