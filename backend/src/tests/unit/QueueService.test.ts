import { QueueService, SupportedQueueName } from '../../services/queues/QueueService';
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Mock BullMQ classes
const mockQueueInstance = {
  add: jest.fn(),
  close: jest.fn(),
  getJob: jest.fn(),
  getJobs: jest.fn()
};

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => mockQueueInstance),
  Worker: jest.fn(),
  QueueEvents: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
}));

// Mock IORedis
jest.mock('ioredis', () => {
  return jest.fn().mockReturnValue({
    quit: jest.fn(),
    ping: jest.fn()
  });
});

describe('QueueService', () => {
  let queueService: QueueService;
  let mockConnection: any;
  let mockQueue: any;
  let mockQueueEvents: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConnection = {
      quit: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG')
    };
    
    mockQueue = (require('bullmq') as any).Queue.mock.instances[0] || mockQueueInstance;
    
    mockQueueEvents = {
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined)
    };
    
    (IORedis as any).mockReturnValue(mockConnection);
    
    queueService = new QueueService({
      redisUrl: 'redis://localhost:6379'
    });
  });

  describe('getQueue', () => {
    it('should return a queue instance', () => {
      const queue = queueService.getQueue('agent-jobs');
      
      expect(queue).toBeDefined();
      expect(queue).toHaveProperty('add');
      expect(queue).toHaveProperty('close');
      expect(queue).toHaveProperty('getJob');
      expect(queue).toHaveProperty('getJobs');
    });
  });

  describe('addJob', () => {
    it('should add a job to the queue', async () => {
      const jobName = 'test-job';
      const jobData = { test: 'data' };
      const jobOptions = { priority: 1 };
      const mockJob = { id: 'job-id', name: jobName, data: jobData };
      
      mockQueue.add.mockResolvedValue(mockJob);
      
      const job = await queueService.addJob('agent-jobs', jobName, jobData, jobOptions);
      
      expect(mockQueue.add).toHaveBeenCalledWith(jobName, jobData, jobOptions);
      expect(job).toEqual(mockJob);
    });
  });

  describe('registerWorker', () => {
    it('should create and return a worker instance', () => {
      const processor = jest.fn();
      
      queueService.registerWorker('agent-jobs', processor);
      
      expect(Worker).toHaveBeenCalledWith(
        'agent-jobs',
        processor,
        expect.objectContaining({
          connection: mockConnection,
          concurrency: 5
        })
      );
    });

    it('should create worker with custom options', () => {
      const processor = jest.fn();
      const customOptions = { connection: mockConnection, concurrency: 10, autorun: false };
      
      queueService.registerWorker('agent-jobs', processor, customOptions);
      
      expect(Worker).toHaveBeenCalledWith(
        'agent-jobs',
        processor,
        expect.objectContaining({
          connection: mockConnection,
          concurrency: 10,
          autorun: false
        })
      );
    });
  });

  describe('getQueueEvents', () => {
    it('should return queue events instance', () => {
      const events = queueService.getQueueEvents('agent-jobs');
      
      expect(events).toBeDefined();
      expect(QueueEvents).toHaveBeenCalledWith('agent-jobs', expect.any(Object));
    });

    it('should return the same queue events instance for the same queue name', () => {
      const events1 = queueService.getQueueEvents('agent-jobs');
      const events2 = queueService.getQueueEvents('agent-jobs');
      
      expect(events1).toBe(events2);
    });
  });

  describe('ping', () => {
    it('should return PONG when connection ping succeeds', async () => {
      mockConnection.ping.mockResolvedValue('PONG');
      
      const result = await queueService.ping();
      
      expect(result).toBe('PONG');
      expect(mockConnection.ping).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close all queues and the connection', async () => {
      // Mock the queues map
      const mockQueues = new Map([
        ['agent-jobs', mockQueue],
        ['file-sync', mockQueue]
      ]);
      
      const mockQueueEventsMap = new Map([
        ['agent-jobs', mockQueueEvents],
        ['file-sync', mockQueueEvents]
      ]);
      
      (queueService as any).queues = mockQueues;
      (queueService as any).queueEvents = mockQueueEventsMap;
      
      // Reset mock call history
      mockQueue.add.mockClear();
      
      await queueService.close();
      
      expect(mockQueue.close).toHaveBeenCalledTimes(2);
      expect(mockQueueEvents.close).toHaveBeenCalledTimes(2);
      expect(mockConnection.quit).toHaveBeenCalled();
    });
  });
});
