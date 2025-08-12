import { QueueService } from '../services/queues/QueueService';
import { LogService } from '../services/agent/LogService';
import winston from 'winston';
import { EventEmitter } from 'events';
export interface AgentContext {
    orgId: string;
    userId?: string;
    sessionId?: string;
    permissions?: string[];
}
export interface AgentLifecycle {
    start(): Promise<void>;
    stop(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    isRunning(): boolean;
    getStatus(): AgentStatus;
    getHealthCheck(): Promise<AgentHealthCheck>;
}
export interface AgentStatus {
    name: string;
    running: boolean;
    paused: boolean;
    error?: string;
    startTime?: Date;
    lastActivity?: Date;
    processedJobs: number;
    failedJobs: number;
}
export interface AgentHealthCheck {
    healthy: boolean;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    queueConnections: boolean;
    lastError?: string;
    performance: {
        averageJobTime: number;
        jobsPerMinute: number;
    };
}
export interface AgentConfig {
    maxRetries: number;
    retryDelay: number;
    healthCheckInterval: number;
    enableMonitoring: boolean;
    logLevel: string;
}
export declare abstract class BaseAgent extends EventEmitter implements AgentLifecycle {
    protected readonly name: string;
    protected readonly queueService: QueueService;
    protected readonly logger: winston.Logger;
    protected readonly logService: LogService;
    protected readonly config: AgentConfig;
    protected running: boolean;
    protected paused: boolean;
    protected startTime?: Date;
    protected lastActivity?: Date;
    protected processedJobs: number;
    protected failedJobs: number;
    protected errorCount: number;
    protected lastError?: string;
    protected healthCheckTimer?: NodeJS.Timeout;
    protected performanceMetrics: {
        jobTimes: number[];
        lastMinuteJobs: Date[];
    };
    constructor(name: string, queueService: QueueService, config?: Partial<AgentConfig>);
    start(): Promise<void>;
    stop(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    isRunning(): boolean;
    getName(): string;
    getStatus(): AgentStatus;
    getHealthCheck(): Promise<AgentHealthCheck>;
    protected executeJob<T>(jobName: string, jobData: any, context: AgentContext, handler: () => Promise<T>): Promise<T>;
    protected validateContext(context: AgentContext): void;
    protected createCommit(orgId: string, message: string, metadata?: any): Promise<string>;
    private logEvent;
    private getUptime;
    private checkQueueConnections;
    private recordJobSuccess;
    private recordJobFailure;
    private startHealthCheckMonitoring;
    private sleep;
    protected abstract onStart(): Promise<void>;
    protected abstract onStop(): Promise<void>;
    protected abstract onPause(): Promise<void>;
    protected abstract onResume(): Promise<void>;
}
//# sourceMappingURL=BaseAgent.d.ts.map