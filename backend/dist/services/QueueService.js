"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
class QueueService {
    constructor() {
        this.redis = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            db: parseInt(process.env.REDIS_DB || '0'),
            lazyConnect: true
        });
        this.subscriber = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            db: parseInt(process.env.REDIS_DB || '0'),
            lazyConnect: true
        });
    }
    async addJob(queueName, jobData, priority) {
        const jobId = this.generateJobId();
        const job = {
            id: jobId,
            data: jobData,
            priority: priority || 0,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        try {
            await this.redis.lpush(`queue:${queueName}`, JSON.stringify(job));
            return jobId;
        }
        catch (error) {
            console.error(`Error adding job to queue ${queueName}:`, error);
            throw error;
        }
    }
    async processQueue(queueName, processor, concurrency = 1) {
        const workers = [];
        for (let i = 0; i < concurrency; i++) {
            workers.push(this.createWorker(queueName, processor));
        }
        await Promise.all(workers);
    }
    async createWorker(queueName, processor) {
        while (true) {
            try {
                const result = await this.redis.brpop(`queue:${queueName}`, 5);
                if (result) {
                    const [_, jobString] = result;
                    const job = JSON.parse(jobString);
                    job.status = 'processing';
                    job.startedAt = new Date().toISOString();
                    await this.updateJob(queueName, job);
                    try {
                        await processor(job);
                        job.status = 'completed';
                        job.completedAt = new Date().toISOString();
                        await this.updateJob(queueName, job);
                    }
                    catch (error) {
                        job.status = 'failed';
                        job.failedAt = new Date().toISOString();
                        job.error = error.message;
                        await this.updateJob(queueName, job);
                        console.error(`Error processing job ${job.id}:`, error);
                    }
                }
            }
            catch (error) {
                console.error(`Error in queue worker for ${queueName}:`, error);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    async updateJob(queueName, job) {
        console.log(`Job ${job.id} in queue ${queueName} updated to status: ${job.status}`);
    }
    async getQueueStats(queueName) {
        try {
            const length = await this.redis.llen(`queue:${queueName}`);
            return {
                queueName,
                length
            };
        }
        catch (error) {
            console.error(`Error getting queue stats for ${queueName}:`, error);
            throw error;
        }
    }
    async healthCheck() {
        try {
            await this.redis.ping();
            return true;
        }
        catch (error) {
            console.error('Redis health check failed:', error);
            return false;
        }
    }
    async close() {
        await this.redis.quit();
        await this.subscriber.quit();
    }
    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.QueueService = QueueService;
//# sourceMappingURL=QueueService.js.map