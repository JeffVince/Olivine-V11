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
            redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
            prefix: 'olivine'
        };
        const finalConfig = { ...defaultConfig, ...config };
        this.connection = new ioredis_1.default(finalConfig.redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        });
        this.queues = new Map();
        this.queueEvents = new Map();
        this.prefix = finalConfig.prefix;
        [
            'file-sync',
            'file-classification',
            'content-extraction',
            'provenance',
            'agent-jobs',
            'create-commit',
            'create-action',
            'create-version',
            'webhook-events',
            'source-sync',
            'delta-sync',
        ].forEach((name) => this.ensureQueue(name));
    }
    getQueue(name) {
        return this.ensureQueue(name);
    }
    async ping() {
        return this.connection.ping?.() ?? 'PONG';
    }
    async addJob(name, jobName, data, options) {
        const queue = this.ensureQueue(name);
        return queue.add(jobName, data, options);
    }
    registerWorker(name, processor, options) {
        const worker = new bullmq_1.Worker(this.fullQueueName(name), processor, {
            connection: this.connection,
            concurrency: 5,
            ...options,
        });
        return worker;
    }
    getQueueEvents(name) {
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
        await this.ping();
    }
    async close() {
        this.queues.forEach(async (q) => await q.close());
        this.queueEvents.forEach(async (e) => await e.close());
        await this.connection.quit();
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