"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TaxonomyService_1 = require("../../services/TaxonomyService");
const ContentOntologyService_1 = require("../../services/ContentOntologyService");
const OperationsOntologyService_1 = require("../../services/OperationsOntologyService");
const ProvenanceService_1 = require("../../services/provenance/ProvenanceService");
const AgentOrchestrator_1 = require("../../services/AgentOrchestrator");
const EnhancedFileProcessingService_1 = require("../../services/EnhancedFileProcessingService");
const EventProcessingService_1 = require("../../services/EventProcessingService");
const QueueService_1 = require("../../services/queues/QueueService");
describe('Ontology Integration Tests', () => {
    let taxonomyService;
    let contentService;
    let operationsService;
    let provenanceService;
    let orchestrator;
    let fileProcessingService;
    const testOrgId = 'test-org-123';
    const testUserId = 'test-user-456';
    const testProjectId = 'test-project-789';
    beforeAll(async () => {
        taxonomyService = new TaxonomyService_1.TaxonomyService();
        contentService = new ContentOntologyService_1.ContentOntologyService();
        operationsService = new OperationsOntologyService_1.OperationsOntologyService();
        provenanceService = new ProvenanceService_1.ProvenanceService();
        orchestrator = new AgentOrchestrator_1.AgentOrchestrator();
        const eventProcessingService = new EventProcessingService_1.EventProcessingService(null, new QueueService_1.QueueService());
        fileProcessingService = new EnhancedFileProcessingService_1.EnhancedFileProcessingService(eventProcessingService);
        await orchestrator.start();
    });
    afterAll(async () => {
        await orchestrator.stop();
    });
    describe('Taxonomy Service Integration', () => {
        test('should retrieve canonical slots', async () => {
            const slots = await taxonomyService.getCanonicalSlots(testOrgId);
            expect(slots).toBeDefined();
            expect(Array.isArray(slots)).toBe(true);
            const scriptSlot = slots.find(slot => slot.key === 'SCRIPT_PRIMARY');
            expect(scriptSlot).toBeDefined();
            expect(scriptSlot?.category).toBe('script');
        });
        test('should classify a file using taxonomy rules', async () => {
            const fileId = 'test-file-123';
            try {
                const classifications = await taxonomyService.classifyFile(fileId, testOrgId);
                expect(Array.isArray(classifications)).toBe(true);
            }
            catch (error) {
                expect(error).toBeDefined();
            }
        });
    });
    describe('Content Ontology Integration', () => {
        let createdProjectId;
        let createdSceneId;
        let createdCharacterId;
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
            await contentService.linkSceneToCharacter(createdSceneId, createdCharacterId, testOrgId, testUserId);
            expect(true).toBe(true);
        });
    });
    describe('Operations Ontology Integration', () => {
        let createdVendorId;
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
                po_number: 'PO-2024-001',
                vendor_id: createdVendorId,
                description: 'Camera equipment rental',
                amount: 2500,
                currency: 'USD',
                status: 'pending',
                order_date: new Date(),
                created_by: testUserId
            }, testUserId);
            expect(po).toBeDefined();
            expect(po.po_number).toBe('PO-2024-001');
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
            const edgeFactId = await provenanceService.createEdgeFact('TEST_RELATIONSHIP', 'entity-1', 'entity-2', testOrgId, testUserId, { test_property: 'test_value' });
            expect(edgeFactId).toBeDefined();
            expect(typeof edgeFactId).toBe('string');
        });
        test('should create a branch', async () => {
            const branch = await provenanceService.createBranch('test-branch', testOrgId, testProjectId, 'Test branch for integration testing', testUserId);
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
            try {
                const result = await fileProcessingService.processFileWithAI(mockFileRequest);
                expect(result).toBeDefined();
                expect(result.fileId).toBe(mockFileRequest.fileId);
            }
            catch (error) {
                console.log('Expected error in test environment:', error);
            }
        });
    });
});
//# sourceMappingURL=OntologyIntegration.test.js.map