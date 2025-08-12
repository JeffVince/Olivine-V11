"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const QueueService_1 = require("../../services/queues/QueueService");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
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
jest.mock('ioredis', () => {
    return jest.fn().mockReturnValue({
        quit: jest.fn(),
        ping: jest.fn()
    });
});
describe('QueueService', () => {
    let queueService;
    let mockConnection;
    let mockQueue;
    let mockQueueEvents;
    beforeEach(() => {
        jest.clearAllMocks();
        mockConnection = {
            quit: jest.fn().mockResolvedValue(undefined),
            ping: jest.fn().mockResolvedValue('PONG')
        };
        mockQueue = require('bullmq').Queue.mock.instances[0] || mockQueueInstance;
        mockQueueEvents = {
            on: jest.fn(),
            close: jest.fn().mockResolvedValue(undefined)
        };
        ioredis_1.default.mockReturnValue(mockConnection);
        queueService = new QueueService_1.QueueService({
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
            expect(bullmq_1.Worker).toHaveBeenCalledWith('agent-jobs', processor, expect.objectContaining({
                connection: mockConnection,
                concurrency: 5
            }));
        });
        it('should create worker with custom options', () => {
            const processor = jest.fn();
            const customOptions = { connection: mockConnection, concurrency: 10, autorun: false };
            queueService.registerWorker('agent-jobs', processor, customOptions);
            expect(bullmq_1.Worker).toHaveBeenCalledWith('agent-jobs', processor, expect.objectContaining({
                connection: mockConnection,
                concurrency: 10,
                autorun: false
            }));
        });
    });
    describe('getQueueEvents', () => {
        it('should return queue events instance', () => {
            const events = queueService.getQueueEvents('agent-jobs');
            expect(events).toBeDefined();
            expect(bullmq_1.QueueEvents).toHaveBeenCalledWith('agent-jobs', expect.any(Object));
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
            const mockQueues = new Map([
                ['agent-jobs', mockQueue],
                ['file-sync', mockQueue]
            ]);
            const mockQueueEventsMap = new Map([
                ['agent-jobs', mockQueueEvents],
                ['file-sync', mockQueueEvents]
            ]);
            queueService.queues = mockQueues;
            queueService.queueEvents = mockQueueEventsMap;
            mockQueue.add.mockClear();
            await queueService.close();
            expect(mockQueue.close).toHaveBeenCalledTimes(2);
            expect(mockQueueEvents.close).toHaveBeenCalledTimes(2);
            expect(mockConnection.quit).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=QueueService.test.js.map