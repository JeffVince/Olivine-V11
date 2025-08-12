"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
const LogService_1 = require("../services/agent/LogService");
const uuid_1 = require("uuid");
const winston_1 = __importDefault(require("winston"));
const events_1 = require("events");
class BaseAgent extends events_1.EventEmitter {
    constructor(name, queueService, config) {
        super();
        this.running = false;
        this.paused = false;
        this.processedJobs = 0;
        this.failedJobs = 0;
        this.errorCount = 0;
        this.performanceMetrics = { jobTimes: [], lastMinuteJobs: [] };
        this.name = name;
        this.queueService = queueService;
        this.logService = new LogService_1.LogService();
        this.config = {
            maxRetries: 3,
            retryDelay: 1000,
            healthCheckInterval: 30000,
            enableMonitoring: true,
            logLevel: 'info',
            ...config
        };
        this.logger = winston_1.default.createLogger({
            level: this.config.logLevel,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json(), winston_1.default.format.label({ label: `agent:${this.name}` })),
            transports: [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                })
            ]
        });
    }
    async start() {
        if (this.running) {
            this.logger.warn(`Agent ${this.name} is already running`);
            return;
        }
        try {
            this.logger.info(`Starting agent ${this.name}`);
            this.startTime = new Date();
            this.lastActivity = new Date();
            this.running = true;
            this.paused = false;
            this.lastError = undefined;
            if (this.config.enableMonitoring) {
                this.startHealthCheckMonitoring();
            }
            await this.onStart();
            this.logger.info(`Agent ${this.name} started successfully`);
            await this.logEvent('agent_started', {
                agentName: this.name,
                startTime: this.startTime
            });
        }
        catch (error) {
            this.running = false;
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to start agent ${this.name}:`, error);
            throw error;
        }
    }
    async stop() {
        if (!this.running) {
            this.logger.warn(`Agent ${this.name} is not running`);
            return;
        }
        try {
            this.logger.info(`Stopping agent ${this.name}`);
            if (this.healthCheckTimer) {
                clearInterval(this.healthCheckTimer);
                this.healthCheckTimer = undefined;
            }
            await this.onStop();
            this.running = false;
            this.paused = false;
            this.logger.info(`Agent ${this.name} stopped successfully`);
            await this.logEvent('agent_stopped', {
                agentName: this.name,
                uptime: this.getUptime()
            });
        }
        catch (error) {
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to stop agent ${this.name}:`, error);
            throw error;
        }
    }
    async pause() {
        if (!this.running || this.paused) {
            this.logger.warn(`Agent ${this.name} cannot be paused in current state`);
            return;
        }
        try {
            this.logger.info(`Pausing agent ${this.name}`);
            this.paused = true;
            await this.onPause();
            await this.logEvent('agent_paused', {
                agentName: this.name
            });
        }
        catch (error) {
            this.paused = false;
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to pause agent ${this.name}:`, error);
            throw error;
        }
    }
    async resume() {
        if (!this.running || !this.paused) {
            this.logger.warn(`Agent ${this.name} cannot be resumed in current state`);
            return;
        }
        try {
            this.logger.info(`Resuming agent ${this.name}`);
            this.paused = false;
            await this.onResume();
            await this.logEvent('agent_resumed', {
                agentName: this.name
            });
        }
        catch (error) {
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to resume agent ${this.name}:`, error);
            throw error;
        }
    }
    isRunning() {
        return this.running && !this.paused;
    }
    getName() {
        return this.name;
    }
    getStatus() {
        return {
            name: this.name,
            running: this.running,
            paused: this.paused,
            error: this.lastError,
            startTime: this.startTime,
            lastActivity: this.lastActivity,
            processedJobs: this.processedJobs,
            failedJobs: this.failedJobs
        };
    }
    async getHealthCheck() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const recentJobs = this.performanceMetrics.lastMinuteJobs.filter(jobTime => jobTime.getTime() > oneMinuteAgo);
        const avgJobTime = this.performanceMetrics.jobTimes.length > 0
            ? this.performanceMetrics.jobTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.jobTimes.length
            : 0;
        return {
            healthy: this.running && !this.lastError,
            uptime: this.getUptime(),
            memoryUsage: process.memoryUsage(),
            queueConnections: await this.checkQueueConnections(),
            lastError: this.lastError,
            performance: {
                averageJobTime: avgJobTime,
                jobsPerMinute: recentJobs.length
            }
        };
    }
    async executeJob(jobName, jobData, context, handler) {
        const jobId = (0, uuid_1.v4)();
        const startTime = Date.now();
        let attempt = 0;
        this.logger.debug(`Starting job ${jobName}`, { jobId, jobData, context });
        while (attempt < this.config.maxRetries) {
            try {
                this.lastActivity = new Date();
                const result = await handler();
                const duration = Date.now() - startTime;
                this.recordJobSuccess(duration);
                this.logger.info(`Job ${jobName} completed successfully`, {
                    jobId,
                    duration,
                    attempt: attempt + 1
                });
                await this.logEvent('job_completed', {
                    agentName: this.name,
                    jobId,
                    jobName,
                    duration,
                    context
                });
                return result;
            }
            catch (error) {
                attempt++;
                const isLastAttempt = attempt >= this.config.maxRetries;
                this.logger.error(`Job ${jobName} failed (attempt ${attempt}/${this.config.maxRetries})`, {
                    jobId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined
                });
                if (isLastAttempt) {
                    this.recordJobFailure();
                    this.lastError = error instanceof Error ? error.message : 'Unknown error';
                    await this.logEvent('job_failed', {
                        agentName: this.name,
                        jobId,
                        jobName,
                        error: this.lastError,
                        attempts: attempt,
                        context
                    });
                    throw error;
                }
                else {
                    await this.sleep(this.config.retryDelay * attempt);
                }
            }
        }
        throw new Error(`Job ${jobName} failed after ${this.config.maxRetries} attempts`);
    }
    validateContext(context) {
        if (!context.orgId) {
            throw new Error('Agent context missing required orgId');
        }
        this.logger.debug(`Validated context for org ${context.orgId}`);
    }
    async createCommit(orgId, message, metadata) {
        const commitId = (0, uuid_1.v4)();
        await this.logEvent('commit_created', {
            agentName: this.name,
            commitId,
            orgId,
            message,
            metadata
        });
        return commitId;
    }
    async logEvent(eventType, data) {
        try {
            await this.logService.appendLog({
                jobId: (0, uuid_1.v4)(),
                timestamp: new Date().toISOString(),
                level: 'info',
                message: `${eventType}: ${JSON.stringify(data)}`
            });
        }
        catch (error) {
            this.logger.error('Failed to log event:', error);
        }
    }
    getUptime() {
        return this.startTime ? Date.now() - this.startTime.getTime() : 0;
    }
    async checkQueueConnections() {
        try {
            return true;
        }
        catch (error) {
            return false;
        }
    }
    recordJobSuccess(duration) {
        this.processedJobs++;
        this.performanceMetrics.jobTimes.push(duration);
        this.performanceMetrics.lastMinuteJobs.push(new Date());
        if (this.performanceMetrics.jobTimes.length > 100) {
            this.performanceMetrics.jobTimes.shift();
        }
    }
    recordJobFailure() {
        this.failedJobs++;
        this.errorCount++;
    }
    startHealthCheckMonitoring() {
        this.healthCheckTimer = setInterval(async () => {
            try {
                const health = await this.getHealthCheck();
                if (!health.healthy) {
                    this.logger.warn(`Agent ${this.name} health check failed`, health);
                }
            }
            catch (error) {
                this.logger.error(`Health check failed for agent ${this.name}:`, error);
            }
        }, this.config.healthCheckInterval);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.BaseAgent = BaseAgent;
//# sourceMappingURL=BaseAgent.js.map