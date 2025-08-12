import { JobService } from '../../services/agent/JobService';
import { QueueService } from '../../services/queues/QueueService';
import { Job } from 'bullmq';
import { pubsub } from '../../services/graphql/PubSub';

// Mock BullMQ Job type
type MockJob = {
  id: string;
  name: string;
  data: any;
  opts: any;
  progress: number;
  attemptsMade: number;
  finishedOn: number | null;
  processedOn: number | null;
  timestamp: number;
  failedReason?: string;
  returnvalue?: any;
  stacktrace?: string[];
};

// Mock QueueService
jest.mock('../../services/queues/QueueService');

// Mock PubSub
jest.mock('../../services/graphql/PubSub', () => ({
  pubsub: {
    publish: jest.fn()
  },
  TOPICS: {
    JobUpdated: 'JOB_UPDATED'
  }
}));

describe('JobService', () => {
  let jobService: JobService;
  let mockQueueService: jest.Mocked<QueueService>;
  let mockQueue: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock queue with BullMQ methods
    mockQueue = {
      getJobs: jest.fn(),
      getJob: jest.fn(),
      add: jest.fn(),
      remove: jest.fn(),
      getJobCounts: jest.fn()
    };
    
    // Create mock queue service
    mockQueueService = {
      getQueue: jest.fn().mockReturnValue(mockQueue)
    } as any;
    
    jobService = new JobService(mockQueueService);
  });

  describe('listAgentJobs', () => {
    it('should return jobs from the queue', async () => {
      const mockJobs: MockJob[] = [
        {
          id: 'job-1',
          name: 'test-job-1',
          data: { test: 'data-1' },
          opts: {},
          progress: 50,
          attemptsMade: 1,
          finishedOn: null,
          processedOn: Date.now(),
          timestamp: Date.now()
        },
        {
          id: 'job-2',
          name: 'test-job-2',
          data: { test: 'data-2' },
          opts: {},
          progress: 100,
          attemptsMade: 1,
          finishedOn: Date.now(),
          processedOn: Date.now(),
          timestamp: Date.now()
        }
      ];
      
      mockQueue.getJobs.mockResolvedValue(mockJobs);
      
      const jobs = await jobService.listAgentJobs();
      
      expect(mockQueue.getJobs).toHaveBeenCalledWith([
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
        'paused'
      ], 0, 49, false);
      expect(jobs).toHaveLength(2);
    });
  });

  describe('getAgentJob', () => {
    it('should return a specific job by ID', async () => {
      const mockJob: MockJob = {
        id: 'test-job-id',
        name: 'test-job',
        data: { test: 'data' },
        opts: {},
        progress: 75,
        attemptsMade: 2,
        finishedOn: null,
        processedOn: Date.now(),
        timestamp: Date.now()
      };
      
      mockQueue.getJob.mockResolvedValue(mockJob);
      
      const job = await jobService.getAgentJob('test-job-id');
      
      expect(mockQueue.getJob).toHaveBeenCalledWith('test-job-id');
      expect(job).toEqual({
        id: mockJob.id,
        orgId: mockJob.data?.orgId,
        type: mockJob.name,
        target: mockJob.data?.target,
        status: 'active',
        priority: mockJob.opts?.priority,
        attemptsMade: mockJob.attemptsMade,
        retries: mockJob.opts?.attempts ?? 0,
        worker: String(mockJob.processedOn),
        startedAt: mockJob.processedOn ? new Date(mockJob.processedOn).toISOString() : null,
        finishedAt: mockJob.finishedOn ? new Date(mockJob.finishedOn).toISOString() : null,
        durationMs: mockJob.finishedOn && mockJob.processedOn ? mockJob.finishedOn - mockJob.processedOn : null,
        params: mockJob.data?.params ?? null
      });
    });

    it('should return null when job is not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);
      
      const job = await jobService.getAgentJob('non-existent-job-id');
      
      expect(mockQueue.getJob).toHaveBeenCalledWith('non-existent-job-id');
      expect(job).toBeNull();
    });
  });

  describe('enqueueAgentJob', () => {
    it('should add a job to the queue', async () => {
      const jobId = 'new-job-id';
      const mockJob: any = { id: jobId };
      
      mockQueue.add.mockResolvedValue(mockJob);
      
      const jobInput = { orgId: 'test-org', type: 'test-job', target: 'test-target' };
      const job = await jobService.enqueueAgentJob(jobInput);
      
      expect(mockQueue.add).toHaveBeenCalledWith(
        'test-job',
        jobInput,
        { priority: 5 }
      );
      expect(job).toEqual({
        id: mockJob.id,
        orgId: mockJob.data?.orgId,
        type: mockJob.name,
        target: mockJob.data?.target,
        status: 'queued',
        priority: mockJob.opts?.priority,
        attemptsMade: mockJob.attemptsMade,
        retries: mockJob.opts?.attempts ?? 0,
        worker: null,
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        params: mockJob.data?.params ?? null
      });
    });
  });

  describe('cancelAgentJob', () => {
    it('should remove a job from the queue', async () => {
      const mockJob: any = { remove: jest.fn() };
      mockQueue.getJob.mockResolvedValue(mockJob);
      
      const result = await jobService.cancelAgentJob('test-job-id');
      
      expect(mockQueue.getJob).toHaveBeenCalledWith('test-job-id');
      expect(mockJob.remove).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when job is not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);
      
      const result = await jobService.cancelAgentJob('non-existent-job-id');
      
      expect(result).toBe(false);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics for all queues', async () => {
      const mockStats = {
        waiting: 5,
        active: 3,
        completed: 10,
        failed: 2,
        delayed: 1
      };
      
      mockQueue.getJobCounts.mockResolvedValue(mockStats);
      
      const stats = await jobService.getQueueStats();
      
      expect(mockQueue.getJobCounts).toHaveBeenCalled();
      expect(stats).toHaveLength(5);
      expect(stats[0]).toEqual({
        name: 'agent-jobs',
        waiting: 5,
        active: 3,
        completed: 10,
        failed: 2,
        delayed: 1
      });
    });
  });
});
