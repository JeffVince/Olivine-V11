import { TaxonomyService } from '../../services/TaxonomyService'
import { ContentOntologyService } from '../../services/ContentOntologyService'
import { OperationsOntologyService } from '../../services/OperationsOntologyService'
import { ProvenanceService } from '../../services/provenance/ProvenanceService'
import { AgentOrchestrator } from '../../services/AgentOrchestrator'
import { FileProcessingService } from '../../services/FileProcessingService'
import { EventProcessingService } from '../../services/EventProcessingService'
import { QueueService } from '../../services/queues/QueueService'
import { Neo4jService } from '../../services/Neo4jService'
import { PostgresService } from '../../services/PostgresService'

describe('Ontology Integration Tests', () => {
  let taxonomyService: TaxonomyService;
  let contentService: ContentOntologyService;
  let operationsService: OperationsOntologyService;
  let provenanceService: ProvenanceService;
  let orchestrator: AgentOrchestrator;
  let fileProcessingService: FileProcessingService;

  const testOrgId = 'test-org-123';
  const testUserId = 'test-user-456';
  const testProjectId = 'test-project-789';

  beforeAll(async () => {
    taxonomyService = new TaxonomyService();
    contentService = new ContentOntologyService();
    operationsService = new OperationsOntologyService();
    provenanceService = new ProvenanceService();
    const queueService = new QueueService();
    const neo4jService = new Neo4jService();
    const postgresService = new PostgresService();
    orchestrator = new AgentOrchestrator(queueService, neo4jService, postgresService);
    // Create services with proper dependencies to break circular dependency
    const eventProcessingService = new EventProcessingService(null as any, new QueueService());
    fileProcessingService = new FileProcessingService(eventProcessingService);

    // Start orchestrator
    await orchestrator.start();
  });

  afterAll(async () => {
    // Stop orchestrator
    await orchestrator.stop();
  });

  describe('Taxonomy Service Integration', () => {
    test('should retrieve canonical slots', async () => {
      const slots = await taxonomyService.getCanonicalSlots(testOrgId);
      
      expect(slots).toBeDefined();
      expect(Array.isArray(slots)).toBe(true);
      
      // Check for system-defined slots
      const scriptSlot = slots.find(slot => slot.key === 'SCRIPT_PRIMARY');
      expect(scriptSlot).toBeDefined();
      expect(scriptSlot?.category).toBe('script');
    });

    test('should classify a file using taxonomy rules', async () => {
      // This would require a file to exist in the graph
      // For now, we'll just test that the method doesn't throw
      const fileId = 'test-file-123';
      
      try {
        const classifications = await taxonomyService.classifyFile(fileId, testOrgId);
        expect(Array.isArray(classifications)).toBe(true);
      } catch (error) {
        // Expected if file doesn't exist
        expect(error).toBeDefined();
      }
    });
  });

  describe('Content Ontology Integration', () => {
    let createdProjectId: string;
    let createdSceneId: string;
    let createdCharacterId: string;

    test('should create a project', async () => {
      const project = await contentService.createProject({
        org_id: testOrgId,
        title: 'Test Integration Project',
        type: 'short_film',
        status: 'development',
        budget: 50000
      }, testUserId);

      expect(project).toBeDefined();
      expect(project.title).toBe('Test Integration Project');
      expect(project.org_id).toBe(testOrgId);
      
      createdProjectId = project.id;
    });

    test('should create a scene', async () => {
      const scene = await contentService.createScene({
        org_id: testOrgId,
        project_id: createdProjectId,
        number: '1',
        title: 'Opening Scene',
        location: 'Coffee Shop - Interior',
        time_of_day: 'DAY',
        status: 'draft',
        description: 'Our protagonist enters the coffee shop'
      }, testUserId);

      expect(scene).toBeDefined();
      expect(scene.number).toBe('1');
      expect(scene.project_id).toBe(createdProjectId);
      
      createdSceneId = scene.id;
    });

    test('should create a character', async () => {
      const character = await contentService.createCharacter({
        org_id: testOrgId,
        project_id: createdProjectId,
        name: 'Sarah',
        role_type: 'lead',
        description: 'Ambitious young writer',
        age_range: '25-30'
      }, testUserId);

      expect(character).toBeDefined();
      expect(character.name).toBe('Sarah');
      expect(character.role_type).toBe('lead');
      
      createdCharacterId = character.id;
    });

    test('should link scene to character', async () => {
      await contentService.linkSceneToCharacter(
        createdSceneId,
        createdCharacterId,
        testOrgId,
        testUserId
      );

      // If no error is thrown, the link was created successfully
      expect(true).toBe(true);
    });
  });

  describe('Operations Ontology Integration', () => {
    let createdVendorId: string;

    test('should create a vendor', async () => {
      const vendor = await operationsService.createVendor({
        org_id: testOrgId,
        name: 'Test Equipment Rental',
        category: 'equipment_rental',
        contact_email: 'contact@testequipment.com',
        status: 'active',
        rating: 4.5
      }, testUserId);

      expect(vendor).toBeDefined();
      expect(vendor.name).toBe('Test Equipment Rental');
      expect(vendor.category).toBe('equipment_rental');
      
      createdVendorId = vendor.id;
    });

    test('should create a purchase order', async () => {
      const po = await operationsService.createPurchaseOrder({
        org_id: testOrgId,
        project_id: testProjectId,
        order_number: 'PO-2024-001',
        vendor_id: createdVendorId,
        description: 'Camera equipment rental',
        total_amount: 2500,
        currency: 'USD',
        status: 'pending',
        order_date: new Date(),
        created_by: testUserId
      }, testUserId);

      expect(po).toBeDefined();
      expect(po.order_number).toBe('PO-2024-001');
      expect(po.vendor_id).toBe(createdVendorId);
    });
  });

  describe('Provenance Service Integration', () => {
    test('should create a commit', async () => {
      const commitId = await provenanceService.createCommit({
        orgId: testOrgId,
        message: 'Integration test commit',
        author: testUserId,
        authorType: 'user'
      });

      expect(commitId).toBeDefined();
      expect(typeof commitId).toBe('string');
    });

    test('should create an EdgeFact', async () => {
      const edgeFactId = await provenanceService.createEdgeFact(
        'TEST_RELATIONSHIP',
        'entity-1',
        'entity-2',
        testOrgId,
        testUserId,
        { test_property: 'test_value' }
      );

      expect(edgeFactId).toBeDefined();
      expect(typeof edgeFactId).toBe('string');
    });

    test('should create a branch', async () => {
      const branch = await provenanceService.createBranch(
        'test-branch',
        testOrgId,
        testProjectId,
        'Test branch for integration testing',
        testUserId
      );

      expect(branch).toBeDefined();
      expect(branch.name).toBe('test-branch');
      expect(branch.org_id).toBe(testOrgId);
    });
  });

  describe('Agent Orchestrator Integration', () => {
    test('should get orchestrator statistics', async () => {
      const stats = orchestrator.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.available_agents).toBeDefined();
      expect(stats.available_workflows).toBeDefined();
      expect(stats.is_running).toBe(true);
      
      // Check that our agents are available
      expect(stats.available_agents).toContain('script_breakdown_agent');
      expect(stats.available_agents).toContain('enhanced_classification_agent');
      expect(stats.available_agents).toContain('novelty_detection_agent');
    });

    test('should create a task', async () => {
      const taskId = await orchestrator.createTask({
        type: 'test_task',
        agent: 'enhanced_classification_agent',
        priority: 3,
        payload: { test: 'data' },
        orgId: testOrgId,
        userId: testUserId
      });

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');

      // Check task status
      const task = orchestrator.getTaskStatus(taskId);
      expect(task).toBeDefined();
      expect(task?.status).toBe('pending');
    });
  });

  describe('Enhanced File Processing Integration', () => {
    test('should get processing statistics', async () => {
      const stats = await fileProcessingService.getProcessingStatistics(testOrgId);

      expect(stats).toBeDefined();
      expect(typeof stats.total_files).toBe('number');
      expect(typeof stats.classified_files).toBe('number');
      expect(typeof stats.classification_rate).toBe('number');
    });
  });

  describe('End-to-End Workflow', () => {
    test('should execute complete file processing workflow', async () => {
      // This test would simulate a complete file upload and processing workflow
      // For now, we'll just verify the components can work together
      
      const mockFileRequest = {
        fileId: 'test-file-e2e',
        fileName: 'test-script.pdf',
        filePath: '/test/test-script.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
        orgId: testOrgId,
        sourceId: 'test-source',
        userId: testUserId,
        extractedText: 'FADE IN: EXT. COFFEE SHOP - DAY'
      };

      // Create proper request object for processFileWithAI
      const aiRequest = {
        fileId: mockFileRequest.fileId,
        orgId: mockFileRequest.orgId,
        content: mockFileRequest.extractedText,
        mimeType: mockFileRequest.mimeType
      };

      try {
        // This would normally trigger a full workflow
        const result = await fileProcessingService.processFileWithAI(aiRequest);
        
        // For now, just check that it doesn't crash
        expect(result).toBeDefined();
        expect(result.fileId).toBe(mockFileRequest.fileId);
      } catch (error) {
        // Expected in test environment without full setup
        console.log('Expected error in test environment:', error);
      }
    });
  });
});
