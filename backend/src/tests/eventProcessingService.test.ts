import { EventProcessingService } from '../services/EventProcessingService';

describe('EventProcessingService', () => {
  let eventProcessingService: EventProcessingService;

  beforeAll(() => {
    eventProcessingService = new EventProcessingService();
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
