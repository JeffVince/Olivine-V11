import { QueueMonitor } from '../../services/queues/QueueMonitor';
import { QueueService } from '../../services/queues/QueueService';
import { Worker, Queue, QueueEvents } from 'bullmq';
import { pubsub } from '../../services/graphql/PubSub';

// Mock BullMQ components
jest.mock('bullmq', () => ({
  Worker: jest.fn(),
  Queue: jest.fn(),
  QueueEvents: jest.fn()
}));

// Mock PubSub
jest.mock('../../services/graphql/PubSub', () => ({
  pubsub: {
    publish: jest.fn()
  },
  TOPICS: {
    JobUpdated: 'JOB_UPDATED',
    JobLogAppended: 'JOB_LOG_APPENDED'
  }
}));

describe('QueueMonitor', () => {
  let queueMonitor: QueueMonitor;
  let mockQueueService: jest.Mocked<QueueService>;
  let mockQueueEvents: any;
  let mockQueue: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock queue events with event emitter functionality
    mockQueueEvents = {
      on: jest.fn().mockImplementation((event, callback) => {
        // Store the callbacks for testing
        if (!mockQueueEvents.callbacks) {
          mockQueueEvents.callbacks = {};
        }
        mockQueueEvents.callbacks[event] = callback;
        return mockQueueEvents;
      })
    };
    
    // Create mock queue with getJob method
    mockQueue = {
      getJob: jest.fn()
    };
    
    // Create mock queue service
    mockQueueService = {
      getQueueEvents: jest.fn().mockReturnValue(mockQueueEvents),
      getQueue: jest.fn().mockReturnValue(mockQueue)
    } as any;
    
    queueMonitor = new QueueMonitor(mockQueueService);
  });

  describe('start', () => {
    it('should register event listeners for all supported queues', () => {
      queueMonitor.start();
      
      // Check that getQueueEvents was called for each queue
      expect(mockQueueService.getQueueEvents).toHaveBeenCalledWith('agent-jobs');
      expect(mockQueueService.getQueueEvents).toHaveBeenCalledWith('file-sync');
      expect(mockQueueService.getQueueEvents).toHaveBeenCalledWith('file-classification');
      expect(mockQueueService.getQueueEvents).toHaveBeenCalledWith('content-extraction');
      expect(mockQueueService.getQueueEvents).toHaveBeenCalledWith('provenance');
      
      // Check that getQueue was called for each queue
      expect(mockQueueService.getQueue).toHaveBeenCalledWith('agent-jobs');
      expect(mockQueueService.getQueue).toHaveBeenCalledWith('file-sync');
      expect(mockQueueService.getQueue).toHaveBeenCalledWith('file-classification');
      expect(mockQueueService.getQueue).toHaveBeenCalledWith('content-extraction');
      expect(mockQueueService.getQueue).toHaveBeenCalledWith('provenance');
      
      // Check that event listeners were registered
      expect(mockQueueEvents.on).toHaveBeenCalledWith('active', expect.any(Function));
      expect(mockQueueEvents.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockQueueEvents.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });

    it('should publish job updates when active event is triggered', async () => {
      queueMonitor.start();
      
      // Mock a job object
      const mockJob = {
        id: 'test-job-id',
        name: 'test-job',
        data: { test: 'data' },
        opts: {}
      };
      
      // Mock getJob to return the job
      mockQueue.getJob.mockResolvedValue(mockJob);
      
      // Trigger the active event callback
      const jobId = 'test-job-id';
      await mockQueueEvents.callbacks['active']({ jobId });
      
      // Check that getJob was called with the correct jobId
      expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
      
      // Check that pubsub.publish was called with the correct topic and job data
      expect(pubsub.publish).toHaveBeenCalledWith(
        'JOB_UPDATED',
        { jobUpdated: expect.any(Object) }
      );
    });

    it('should publish job updates when completed event is triggered', async () => {
      queueMonitor.start();
      
      // Mock a job object
      const mockJob = {
        id: 'test-job-id',
        name: 'test-job',
        data: { test: 'data' },
        opts: {}
      };
      
      // Mock getJob to return the job
      mockQueue.getJob.mockResolvedValue(mockJob);
      
      // Trigger the completed event callback
      const jobId = 'test-job-id';
      await mockQueueEvents.callbacks['completed']({ jobId });
      
      // Check that getJob was called with the correct jobId
      expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
      
      // Check that pubsub.publish was called with the correct topic and job data
      expect(pubsub.publish).toHaveBeenCalledWith(
        'JOB_UPDATED',
        { jobUpdated: expect.any(Object) }
      );
    });

    it('should publish job updates when failed event is triggered', async () => {
      queueMonitor.start();
      
      // Mock a job object
      const mockJob = {
        id: 'test-job-id',
        name: 'test-job',
        data: { test: 'data' },
        opts: {}
      };
      
      // Mock getJob to return the job
      mockQueue.getJob.mockResolvedValue(mockJob);
      
      // Trigger the failed event callback
      const jobId = 'test-job-id';
      await mockQueueEvents.callbacks['failed']({ jobId });
      
      // Check that getJob was called with the correct jobId
      expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
      
      // Check that pubsub.publish was called with the correct topic and job data
      expect(pubsub.publish).toHaveBeenCalledWith(
        'JOB_UPDATED',
        { jobUpdated: expect.any(Object) }
      );
    });
  });
});
