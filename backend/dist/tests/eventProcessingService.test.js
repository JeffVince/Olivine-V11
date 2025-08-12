"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const EventProcessingService_1 = require("../services/EventProcessingService");
const FileProcessingService_1 = require("../services/FileProcessingService");
const QueueService_1 = require("../services/queues/QueueService");
describe('EventProcessingService', () => {
    let eventProcessingService;
    beforeAll(() => {
        const eventProcessingServiceInstance = new EventProcessingService_1.EventProcessingService(null, new QueueService_1.QueueService());
        const fileProcessingService = new FileProcessingService_1.FileProcessingService(eventProcessingServiceInstance);
        eventProcessingServiceInstance.fileProcessingService = fileProcessingService;
        eventProcessingService = eventProcessingServiceInstance;
    });
    afterAll(async () => {
        await eventProcessingService.close();
    });
    it('should instantiate successfully', () => {
        expect(eventProcessingService).toBeDefined();
    });
    it('should have all three queues defined', () => {
        expect(eventProcessingService).toHaveProperty('fileSyncQueue');
        expect(eventProcessingService).toHaveProperty('fileClassificationQueue');
        expect(eventProcessingService).toHaveProperty('contentExtractionQueue');
    });
    it('should add sync job to queue', async () => {
        const jobId = await eventProcessingService.addSyncJob({
            fileId: 'test-file-id',
            sourceId: 'test-source-id',
            orgId: 'test-org-id',
            action: 'create',
            filePath: '/test/path/file.txt',
            metadata: { size: 100, mime_type: 'text/plain' }
        });
        expect(jobId).toBeDefined();
        expect(typeof jobId).toBe('string');
    });
    it('should add classification job to queue', async () => {
        const jobId = await eventProcessingService.addClassificationJob({
            fileId: 'test-file-id',
            orgId: 'test-org-id',
            fileContent: 'test content',
            mimeType: 'text/plain'
        });
        expect(jobId).toBeDefined();
        expect(typeof jobId).toBe('string');
    });
    it('should add extraction job to queue', async () => {
        const jobId = await eventProcessingService.addExtractionJob({
            fileId: 'test-file-id',
            orgId: 'test-org-id',
            fileContent: 'test content',
            mimeType: 'text/plain'
        });
        expect(jobId).toBeDefined();
        expect(typeof jobId).toBe('string');
    });
});
//# sourceMappingURL=eventProcessingService.test.js.map