"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const QueueMonitor_1 = require("../../services/queues/QueueMonitor");
const PubSub_1 = require("../../services/graphql/PubSub");
jest.mock('bullmq', () => ({
    Worker: jest.fn(),
    Queue: jest.fn(),
    QueueEvents: jest.fn()
}));
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
    let queueMonitor;
    let mockQueueService;
    let mockQueueEvents;
    let mockQueue;
    beforeEach(() => {
        jest.clearAllMocks();
        mockQueueEvents = {
            on: jest.fn().mockImplementation((event, callback) => {
                if (!mockQueueEvents.callbacks) {
                    mockQueueEvents.callbacks = {};
                }
                mockQueueEvents.callbacks[event] = callback;
                return mockQueueEvents;
            })
        };
        mockQueue = {
            getJob: jest.fn()
        };
        mockQueueService = {
            getQueueEvents: jest.fn().mockReturnValue(mockQueueEvents),
            getQueue: jest.fn().mockReturnValue(mockQueue)
        };
        queueMonitor = new QueueMonitor_1.QueueMonitor(mockQueueService);
    });
    describe('start', () => {
        it('should register event listeners for all supported queues', () => {
            queueMonitor.start();
            expect(mockQueueService.getQueueEvents).toHaveBeenCalledWith('agent-jobs');
            expect(mockQueueService.getQueueEvents).toHaveBeenCalledWith('file-sync');
            expect(mockQueueService.getQueueEvents).toHaveBeenCalledWith('file-classification');
            expect(mockQueueService.getQueueEvents).toHaveBeenCalledWith('content-extraction');
            expect(mockQueueService.getQueueEvents).toHaveBeenCalledWith('provenance');
            expect(mockQueueService.getQueue).toHaveBeenCalledWith('agent-jobs');
            expect(mockQueueService.getQueue).toHaveBeenCalledWith('file-sync');
            expect(mockQueueService.getQueue).toHaveBeenCalledWith('file-classification');
            expect(mockQueueService.getQueue).toHaveBeenCalledWith('content-extraction');
            expect(mockQueueService.getQueue).toHaveBeenCalledWith('provenance');
            expect(mockQueueEvents.on).toHaveBeenCalledWith('active', expect.any(Function));
            expect(mockQueueEvents.on).toHaveBeenCalledWith('completed', expect.any(Function));
            expect(mockQueueEvents.on).toHaveBeenCalledWith('failed', expect.any(Function));
        });
        it('should publish job updates when active event is triggered', async () => {
            queueMonitor.start();
            const mockJob = {
                id: 'test-job-id',
                name: 'test-job',
                data: { test: 'data' },
                opts: {}
            };
            mockQueue.getJob.mockResolvedValue(mockJob);
            const jobId = 'test-job-id';
            await mockQueueEvents.callbacks['active']({ jobId });
            expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
            expect(PubSub_1.pubsub.publish).toHaveBeenCalledWith('JOB_UPDATED', { jobUpdated: expect.any(Object) });
        });
        it('should publish job updates when completed event is triggered', async () => {
            queueMonitor.start();
            const mockJob = {
                id: 'test-job-id',
                name: 'test-job',
                data: { test: 'data' },
                opts: {}
            };
            mockQueue.getJob.mockResolvedValue(mockJob);
            const jobId = 'test-job-id';
            await mockQueueEvents.callbacks['completed']({ jobId });
            expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
            expect(PubSub_1.pubsub.publish).toHaveBeenCalledWith('JOB_UPDATED', { jobUpdated: expect.any(Object) });
        });
        it('should publish job updates when failed event is triggered', async () => {
            queueMonitor.start();
            const mockJob = {
                id: 'test-job-id',
                name: 'test-job',
                data: { test: 'data' },
                opts: {}
            };
            mockQueue.getJob.mockResolvedValue(mockJob);
            const jobId = 'test-job-id';
            await mockQueueEvents.callbacks['failed']({ jobId });
            expect(mockQueue.getJob).toHaveBeenCalledWith(jobId);
            expect(PubSub_1.pubsub.publish).toHaveBeenCalledWith('JOB_UPDATED', { jobUpdated: expect.any(Object) });
        });
    });
});
//# sourceMappingURL=QueueMonitor.test.js.map