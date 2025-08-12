"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentRegistry = exports.AgentRegistry = void 0;
const FileStewardAgent_1 = require("./FileStewardAgent");
const TaxonomyClassificationAgent_1 = require("./TaxonomyClassificationAgent");
const ProvenanceTrackingAgent_1 = require("./ProvenanceTrackingAgent");
const SyncAgent_1 = require("./SyncAgent");
const QueueService_1 = require("../services/queues/QueueService");
const Neo4jService_1 = require("../services/Neo4jService");
const PostgresService_1 = require("../services/PostgresService");
const events_1 = require("events");
const winston_1 = __importDefault(require("winston"));
class AgentRegistry extends events_1.EventEmitter {
    constructor() {
        super();
        this.agents = new Map();
        this.queueService = new QueueService_1.QueueService();
        this.neo4jService = new Neo4jService_1.Neo4jService();
        this.postgresService = new PostgresService_1.PostgresService();
        this.logger = winston_1.default.createLogger({
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json(), winston_1.default.format.label({ label: 'agent-registry' })),
            transports: [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                }),
                new winston_1.default.transports.File({
                    filename: 'logs/agent-registry.log',
                    format: winston_1.default.format.json()
                })
            ]
        });
    }
    async initialize() {
        this.logger.info('Initializing Agent Registry...');
        try {
            await this.queueService.connect();
            await this.neo4jService.connect();
            await this.postgresService.connect();
            await this.registerCoreAgents();
            this.startHeartbeatMonitoring();
            this.startHealthChecking();
            this.startScalingMonitoring();
            this.logger.info('Agent Registry initialized successfully');
            this.emit('registry-initialized');
        }
        catch (error) {
            this.logger.error('Failed to initialize Agent Registry:', error);
            throw error;
        }
    }
    async registerCoreAgents() {
        this.logger.info('Registering core agents...');
        const agentConfigs = [
            {
                type: 'file-steward',
                class: FileStewardAgent_1.FileStewardAgent,
                config: {
                    maxConcurrentJobs: 5,
                    retryAttempts: 3,
                    retryDelay: 5000
                }
            },
            {
                type: 'taxonomy-classification',
                class: TaxonomyClassificationAgent_1.TaxonomyClassificationAgent,
                config: {
                    maxConcurrentJobs: 10,
                    retryAttempts: 2,
                    retryDelay: 3000
                }
            },
            {
                type: 'provenance-tracking',
                class: ProvenanceTrackingAgent_1.ProvenanceTrackingAgent,
                config: {
                    maxConcurrentJobs: 15,
                    retryAttempts: 3,
                    retryDelay: 2000
                }
            },
            {
                type: 'sync',
                class: SyncAgent_1.SyncAgent,
                config: {
                    maxConcurrentJobs: 3,
                    retryAttempts: 5,
                    retryDelay: 10000
                }
            }
        ];
        for (const agentConfig of agentConfigs) {
            await this.registerAgent(agentConfig.type, agentConfig.class, agentConfig.config);
        }
        this.logger.info(`Registered ${agentConfigs.length} core agents`);
    }
    async registerAgent(agentType, AgentClass, config = {}) {
        const agentId = `${agentType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.logger.info(`Registering agent: ${agentType} (${agentId})`);
        try {
            const agentInstance = new AgentClass(this.queueService, config);
            const agentMetadata = {
                id: agentId,
                name: agentInstance.getName(),
                type: agentType,
                status: 'stopped',
                instance: agentInstance,
                config,
                errorCount: 0,
                processingStats: {
                    jobsProcessed: 0,
                    jobsSucceeded: 0,
                    jobsFailed: 0,
                    avgProcessingTime: 0
                }
            };
            this.agents.set(agentId, agentMetadata);
            this.setupAgentListeners(agentId, agentInstance);
            await this.startAgent(agentId);
            this.logger.info(`Agent registered and started: ${agentType} (${agentId})`);
            this.emit('agent-registered', { agentId, agentType });
            return agentId;
        }
        catch (error) {
            this.logger.error(`Failed to register agent ${agentType}:`, error);
            throw error;
        }
    }
    async startAgent(agentId) {
        const agentMeta = this.agents.get(agentId);
        if (!agentMeta) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        if (agentMeta.status === 'running') {
            this.logger.warn(`Agent ${agentId} is already running`);
            return;
        }
        this.logger.info(`Starting agent: ${agentId}`);
        try {
            agentMeta.status = 'starting';
            agentMeta.startedAt = new Date();
            agentMeta.lastHeartbeat = new Date();
            await agentMeta.instance.start();
            agentMeta.status = 'running';
            this.logger.info(`Agent started successfully: ${agentId}`);
            this.emit('agent-started', { agentId, agentType: agentMeta.type });
        }
        catch (error) {
            agentMeta.status = 'error';
            agentMeta.errorCount++;
            this.logger.error(`Failed to start agent ${agentId}:`, error);
            this.emit('agent-error', { agentId, error: error instanceof Error ? error.message : 'Unknown error' });
            throw error;
        }
    }
    async stopAgent(agentId) {
        const agentMeta = this.agents.get(agentId);
        if (!agentMeta) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        if (agentMeta.status === 'stopped') {
            this.logger.warn(`Agent ${agentId} is already stopped`);
            return;
        }
        this.logger.info(`Stopping agent: ${agentId}`);
        try {
            agentMeta.status = 'stopping';
            await agentMeta.instance.stop();
            agentMeta.status = 'stopped';
            this.logger.info(`Agent stopped successfully: ${agentId}`);
            this.emit('agent-stopped', { agentId, agentType: agentMeta.type });
        }
        catch (error) {
            agentMeta.status = 'error';
            agentMeta.errorCount++;
            this.logger.error(`Failed to stop agent ${agentId}:`, error);
            this.emit('agent-error', { agentId, error: error instanceof Error ? error.message : 'Unknown error' });
            throw error;
        }
    }
    async pauseAgent(agentId) {
        const agentMeta = this.agents.get(agentId);
        if (!agentMeta) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        this.logger.info(`Pausing agent: ${agentId}`);
        try {
            await agentMeta.instance.pause();
            agentMeta.status = 'paused';
            this.emit('agent-paused', { agentId, agentType: agentMeta.type });
        }
        catch (error) {
            agentMeta.errorCount++;
            this.logger.error(`Failed to pause agent ${agentId}:`, error);
            throw error;
        }
    }
    async resumeAgent(agentId) {
        const agentMeta = this.agents.get(agentId);
        if (!agentMeta) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        this.logger.info(`Resuming agent: ${agentId}`);
        try {
            await agentMeta.instance.resume();
            agentMeta.status = 'running';
            this.emit('agent-resumed', { agentId, agentType: agentMeta.type });
        }
        catch (error) {
            agentMeta.errorCount++;
            this.logger.error(`Failed to resume agent ${agentId}:`, error);
            throw error;
        }
    }
    async restartAgent(agentId) {
        this.logger.info(`Restarting agent: ${agentId}`);
        try {
            await this.stopAgent(agentId);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.startAgent(agentId);
            this.emit('agent-restarted', { agentId });
        }
        catch (error) {
            this.logger.error(`Failed to restart agent ${agentId}:`, error);
            throw error;
        }
    }
    async removeAgent(agentId) {
        const agentMeta = this.agents.get(agentId);
        if (!agentMeta) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        this.logger.info(`Removing agent: ${agentId}`);
        try {
            if (agentMeta.status === 'running') {
                await this.stopAgent(agentId);
            }
            this.agents.delete(agentId);
            this.logger.info(`Agent removed: ${agentId}`);
            this.emit('agent-removed', { agentId, agentType: agentMeta.type });
        }
        catch (error) {
            this.logger.error(`Failed to remove agent ${agentId}:`, error);
            throw error;
        }
    }
    getAgentDiscovery() {
        const registeredAgents = Array.from(this.agents.keys());
        const activeAgents = registeredAgents.filter(id => {
            const agent = this.agents.get(id);
            return agent?.status === 'running';
        });
        const availableAgents = [
            'file-steward',
            'taxonomy-classification',
            'provenance-tracking',
            'sync'
        ];
        let systemHealth = 'healthy';
        const errorAgents = registeredAgents.filter(id => {
            const agent = this.agents.get(id);
            return agent?.status === 'error' || (agent?.errorCount ?? 0) > 5;
        });
        if (errorAgents.length > 0) {
            systemHealth = errorAgents.length > activeAgents.length / 2 ? 'critical' : 'degraded';
        }
        return {
            registeredAgents,
            activeAgents,
            availableAgents,
            systemHealth
        };
    }
    getAgent(agentId) {
        return this.agents.get(agentId) || null;
    }
    getAllAgents() {
        return Array.from(this.agents.values());
    }
    getAgentsByType(agentType) {
        return Array.from(this.agents.values()).filter(agent => agent.type === agentType);
    }
    getSystemStats() {
        const agents = Array.from(this.agents.values());
        return {
            totalAgents: agents.length,
            runningAgents: agents.filter(a => a.status === 'running').length,
            pausedAgents: agents.filter(a => a.status === 'paused').length,
            errorAgents: agents.filter(a => a.status === 'error').length,
            totalJobsProcessed: agents.reduce((sum, a) => sum + a.processingStats.jobsProcessed, 0),
            totalJobsSucceeded: agents.reduce((sum, a) => sum + a.processingStats.jobsSucceeded, 0),
            totalJobsFailed: agents.reduce((sum, a) => sum + a.processingStats.jobsFailed, 0),
            avgProcessingTime: agents.reduce((sum, a, _, arr) => sum + (a.processingStats.avgProcessingTime / arr.length), 0),
            systemUptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        };
    }
    setupAgentListeners(agentId, agentInstance) {
        agentInstance.on('job-completed', (data) => {
            const agentMeta = this.agents.get(agentId);
            if (agentMeta) {
                agentMeta.processingStats.jobsProcessed++;
                agentMeta.processingStats.jobsSucceeded++;
                agentMeta.lastHeartbeat = new Date();
            }
            this.emit('agent-job-completed', { agentId, ...data });
        });
        agentInstance.on('job-failed', (data) => {
            const agentMeta = this.agents.get(agentId);
            if (agentMeta) {
                agentMeta.processingStats.jobsProcessed++;
                agentMeta.processingStats.jobsFailed++;
                agentMeta.errorCount++;
                agentMeta.lastHeartbeat = new Date();
            }
            this.emit('agent-job-failed', { agentId, ...data });
        });
        agentInstance.on('error', (error) => {
            const agentMeta = this.agents.get(agentId);
            if (agentMeta) {
                agentMeta.status = 'error';
                agentMeta.errorCount++;
            }
            this.emit('agent-error', { agentId, error: error instanceof Error ? error.message : 'Unknown error' });
        });
    }
    startHeartbeatMonitoring() {
        this.heartbeatInterval = setInterval(() => {
            for (const [agentId, agentMeta] of this.agents.entries()) {
                if (agentMeta.status === 'running') {
                    agentMeta.lastHeartbeat = new Date();
                }
            }
        }, 30 * 1000);
    }
    startHealthChecking() {
        this.healthCheckInterval = setInterval(async () => {
            for (const [agentId, agentMeta] of this.agents.entries()) {
                try {
                    if (agentMeta.status === 'running' && agentMeta.instance.isRunning()) {
                        continue;
                    }
                    if (agentMeta.status === 'running' && !agentMeta.instance.isRunning()) {
                        this.logger.warn(`Agent ${agentId} appears unhealthy, restarting...`);
                        await this.restartAgent(agentId);
                    }
                }
                catch (error) {
                    this.logger.error(`Health check failed for agent ${agentId}:`, error);
                }
            }
        }, 60 * 1000);
    }
    startScalingMonitoring() {
        this.scalingCheckInterval = setInterval(() => {
            const stats = this.getSystemStats();
            this.logger.debug('System stats:', stats);
        }, 5 * 60 * 1000);
    }
    async shutdown() {
        this.logger.info('Shutting down Agent Registry...');
        try {
            if (this.heartbeatInterval)
                clearInterval(this.heartbeatInterval);
            if (this.healthCheckInterval)
                clearInterval(this.healthCheckInterval);
            if (this.scalingCheckInterval)
                clearInterval(this.scalingCheckInterval);
            const stopPromises = Array.from(this.agents.keys()).map(agentId => this.stopAgent(agentId).catch(error => this.logger.error(`Error stopping agent ${agentId}:`, error)));
            await Promise.all(stopPromises);
            await this.queueService.close();
            await this.neo4jService.close();
            await this.postgresService.close();
            this.logger.info('Agent Registry shut down successfully');
            this.emit('registry-shutdown');
        }
        catch (error) {
            this.logger.error('Error during Agent Registry shutdown:', error);
            throw error;
        }
    }
}
exports.AgentRegistry = AgentRegistry;
exports.agentRegistry = new AgentRegistry();
//# sourceMappingURL=AgentRegistry.js.map