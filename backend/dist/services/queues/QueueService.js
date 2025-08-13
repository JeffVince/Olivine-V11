"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueService = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
class QueueService {
    constructor(config) {
        const defaultConfig = {
            redisUrl: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}/${process.env.REDIS_DB || '0'}`,
            prefix: 'olivine'
        };
        const finalConfig = { ...defaultConfig, ...config };
        console.log('Redis URL being used:', finalConfig.redisUrl);
        const isTestMode = process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'test';
        this.connection = isTestMode ? null : new ioredis_1.default(finalConfig.redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        });
        this.queues = new Map();
        this.queueEvents = new Map();
        this.inMemoryWorkers = new Map();
        this.inMemoryQueues = new Map();
        this.prefix = finalConfig.prefix;
        [
            'file-sync',
            'file-classification',
            'content-extraction',
            'content-promotion',
            'content-rollback',
            'ontology-review',
            'cluster-orchestration',
            'provenance',
            'agent-jobs',
            'create-commit',
            'create-action',
            'create-version',
            'webhook-events',
            'source-sync',
            'delta-sync',
        ].forEach((name) => {
            if (!isTestMode)
                this.ensureQueue(name);
            if (isTestMode) {
                this.inMemoryQueues.set(name, []);
            }
        });
    }
    getQueue(name) {
        return this.ensureQueue(name);
    }
    async ping() {
        return this.connection.ping?.() ?? 'PONG';
    }
    async addJob(name, jobName, data, options) {
        const isTestMode = this.connection === null;
        if (isTestMode) {
            const jobId = `${name}:${jobName}:${Date.now()}`;
            const processor = this.inMemoryWorkers.get(name);
            if (processor) {
                setImmediate(async () => {
                    try {
                        await processor({ id: jobId, name: jobName, data });
                    }
                    catch (e) {
                    }
                });
            }
            else {
                const q = this.inMemoryQueues.get(name);
                q?.push({ jobName, data });
            }
            return { id: jobId };
        }
        const queue = this.ensureQueue(name);
        return queue.add(jobName, data, options);
    }
    registerWorker(name, processor, options) {
        const isTestMode = this.connection === null;
        if (isTestMode) {
            this.inMemoryWorkers.set(name, processor);
            const pending = this.inMemoryQueues.get(name) || [];
            for (const j of pending) {
                setImmediate(() => processor({ id: `${name}:${Date.now()}`, name: j.jobName, data: j.data }));
            }
            this.inMemoryQueues.set(name, []);
            return { close: async () => { } };
        }
        const worker = new bullmq_1.Worker(this.fullQueueName(name), processor, {
            connection: this.connection,
            concurrency: 5,
            ...options,
        });
        return worker;
    }
    getQueueEvents(name) {
        const isTestMode = this.connection === null;
        if (isTestMode) {
            return { on: () => { }, off: () => { }, close: async () => { } };
        }
        let events = this.queueEvents.get(name);
        if (!events) {
            events = new bullmq_1.QueueEvents(this.fullQueueName(name), { connection: this.connection });
            this.queueEvents.set(name, events);
        }
        return events;
    }
    static getInstance(config) {
        if (!QueueService.instance) {
            QueueService.instance = new QueueService(config);
        }
        return QueueService.instance;
    }
    async connect() {
        if (this.connection) {
            await this.ping();
        }
    }
    async close() {
        for (const q of this.queues.values()) {
            await q.close();
        }
        for (const e of this.queueEvents.values()) {
            await e.close();
        }
        if (this.connection) {
            await this.connection.quit();
        }
    }
    async *subscribeToJobUpdates(orgId) {
        const queueEvents = this.queueEvents.get('agent-jobs');
        if (queueEvents) {
            return;
        }
        return;
    }
    ensureQueue(name) {
        let queue = this.queues.get(name);
        if (!queue) {
            const opts = {
                connection: this.connection,
                prefix: this.prefix,
                defaultJobOptions: {
                    removeOnComplete: 100,
                    removeOnFail: 100,
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 2000 },
                },
            };
            queue = new bullmq_1.Queue(this.fullQueueName(name), opts);
            this.queues.set(name, queue);
        }
        return queue;
    }
    fullQueueName(name) {
        return name;
    }
}
exports.QueueService = QueueService;
QueueService.instance = null;
//# sourceMappingURL=QueueService.js.map