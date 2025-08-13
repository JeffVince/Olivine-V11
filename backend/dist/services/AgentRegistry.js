"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRegistry = void 0;
const FileStewardAgent_1 = require("../agents/FileStewardAgent");
const TaxonomyClassificationAgent_1 = require("../agents/TaxonomyClassificationAgent");
const ProvenanceTrackingAgent_1 = require("../agents/ProvenanceTrackingAgent");
const SyncAgent_1 = require("../agents/SyncAgent");
const CrossLayerEnforcementService_1 = require("./CrossLayerEnforcementService");
const winston = __importStar(require("winston"));
class AgentRegistry {
    constructor(queueService, crossLayerService) {
        this.agents = new Map();
        this.crossLayerService = null;
        this.neo4jService = null;
        this.postgresService = null;
        this.clusterMode = false;
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.printf(({ timestamp, level, message }) => {
                return `${timestamp} [${level}] AgentRegistry: ${message}`;
            })),
            transports: [
                new winston.transports.Console()
            ]
        });
        this.queueService = queueService || {};
        this.crossLayerService = crossLayerService || null;
    }
    static getInstance() {
        if (!AgentRegistry.instance) {
            AgentRegistry.instance = new AgentRegistry();
        }
        return AgentRegistry.instance;
    }
    setServices(neo4jService, postgresService, queueService) {
        this.neo4jService = neo4jService;
        this.postgresService = postgresService;
        this.queueService = queueService;
    }
    async initializeAgents() {
        this.logger.info('Initializing agent registry...');
        try {
            const fileStewardAgent = new FileStewardAgent_1.FileStewardAgent(this.queueService);
            if (this.clusterMode && this.neo4jService && this.postgresService) {
                fileStewardAgent.enableClusterMode();
                this.crossLayerService = new CrossLayerEnforcementService_1.CrossLayerEnforcementService(this.neo4jService, this.postgresService);
                this.logger.info('Initialized cluster-centric services');
            }
            this.registerAgent('file-steward-agent', fileStewardAgent);
            const taxonomyAgent = new TaxonomyClassificationAgent_1.TaxonomyClassificationAgent(this.queueService);
            this.registerAgent('taxonomy-agent', taxonomyAgent);
            const provenanceAgent = new ProvenanceTrackingAgent_1.ProvenanceTrackingAgent(this.queueService);
            this.registerAgent('provenance-agent', provenanceAgent);
            const syncAgent = new SyncAgent_1.SyncAgent(this.queueService);
            this.registerAgent('sync-agent', syncAgent);
            this.logger.info(`Initialized ${this.agents.size} agents`);
        }
        catch (error) {
            this.logger.error('Failed to initialize agents:', error);
            throw error;
        }
    }
    registerAgent(name, agent) {
        if (this.agents.has(name)) {
            throw new Error(`Agent with name '${name}' is already registered`);
        }
        this.agents.set(name, agent);
        this.logger.info(`Registered agent: ${name}`);
    }
    async startAllAgents() {
        this.logger.info('Starting all agents...');
        const startPromises = Array.from(this.agents.entries()).map(async ([name, agent]) => {
            try {
                if (typeof agent.start === 'function') {
                    await agent.start();
                    this.logger.info(`Started agent: ${name}`);
                }
            }
            catch (error) {
                this.logger.error(`Failed to start agent ${name}:`, error);
                throw error;
            }
        });
        await Promise.all(startPromises);
        this.logger.info('All agents started successfully');
    }
    async stopAllAgents() {
        this.logger.info('Stopping all agents...');
        const stopPromises = Array.from(this.agents.entries()).map(async ([name, agent]) => {
            try {
                if (typeof agent.stop === 'function') {
                    await agent.stop();
                    this.logger.info(`Stopped agent: ${name}`);
                }
            }
            catch (error) {
                this.logger.error(`Failed to stop agent ${name}:`, error);
            }
        });
        await Promise.all(stopPromises);
        this.logger.info('All agents stopped');
    }
    async startAgent(name) {
        const agent = this.agents.get(name);
        if (!agent) {
            throw new Error(`Agent '${name}' not found`);
        }
        if (typeof agent.start === 'function') {
            await agent.start();
            this.logger.info(`Started agent: ${name}`);
        }
    }
    async stopAgent(name) {
        const agent = this.agents.get(name);
        if (!agent) {
            throw new Error(`Agent '${name}' not found`);
        }
        if (typeof agent.stop === 'function') {
            await agent.stop();
            this.logger.info(`Stopped agent: ${name}`);
        }
    }
    async pauseAgent(name) {
        const agent = this.agents.get(name);
        if (!agent) {
            throw new Error(`Agent '${name}' not found`);
        }
        if (typeof agent.pause === 'function') {
            await agent.pause();
            this.logger.info(`Paused agent: ${name}`);
        }
    }
    async resumeAgent(name) {
        const agent = this.agents.get(name);
        if (!agent) {
            throw new Error(`Agent '${name}' not found`);
        }
        if (typeof agent.resume === 'function') {
            await agent.resume();
            this.logger.info(`Resumed agent: ${name}`);
        }
    }
    getAllAgents() {
        return Array.from(this.agents.values());
    }
    getActiveAgents() {
        return Array.from(this.agents.values()).filter(agent => agent.isRunning());
    }
    getAgent(name) {
        return this.agents.get(name);
    }
    getRegisteredAgents() {
        return Array.from(this.agents.keys());
    }
    getHealthStatus() {
        const agentStatus = {};
        let allHealthy = true;
        for (const [name, agent] of this.agents) {
            const isHealthy = agent.isRunning();
            agentStatus[name] = isHealthy;
            if (!isHealthy) {
                allHealthy = false;
            }
        }
        return {
            healthy: allHealthy,
            agents: agentStatus
        };
    }
    async validateCrossLayerLinks(orgId) {
        if (!this.crossLayerService) {
            throw new Error('Cross-layer enforcement service not initialized. Enable cluster mode first.');
        }
        try {
            this.logger.info('Starting cross-layer link validation...', { orgId });
            const results = await this.crossLayerService.validateAllLinks(orgId);
            const totalViolations = results.reduce((sum, r) => sum + r.violationsFound, 0);
            const totalRepaired = results.reduce((sum, r) => sum + r.violationsRepaired, 0);
            this.logger.info('Cross-layer link validation completed successfully', {
                orgId,
                rulesValidated: results.length,
                violationsFound: totalViolations,
                violationsRepaired: totalRepaired
            });
        }
        catch (error) {
            this.logger.error('Cross-layer link validation failed:', error);
            throw error;
        }
    }
    async performHealthCheck() {
        const result = {
            healthy: true,
            agents: {}
        };
        for (const [name, agent] of this.agents) {
            try {
                const healthCheck = await agent.getHealthCheck();
                result.agents[name] = { healthy: healthCheck.healthy };
                if (!healthCheck.healthy) {
                    result.healthy = false;
                }
            }
            catch (error) {
                this.logger.error(`Health check failed for agent ${name}:`, error);
                result.agents[name] = {
                    healthy: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
                result.healthy = false;
            }
        }
        return result;
    }
    async shutdown() {
        this.logger.info('Initiating graceful shutdown...');
        try {
            await this.stopAllAgents();
            if (this.crossLayerService) {
                this.logger.info('Stopping cross-layer enforcement service...');
            }
            this.logger.info('Graceful shutdown completed');
        }
        catch (error) {
            this.logger.error('Error during shutdown:', error);
            throw error;
        }
    }
    disableClusterMode() {
        this.logger.info('Disabling cluster mode for all agents...');
        this.clusterMode = false;
        this.agents.forEach((agent, agentId) => {
            if (typeof agent.disableClusterMode === 'function') {
                agent.disableClusterMode();
                this.logger.info(`Cluster mode disabled for agent: ${agentId}`);
            }
        });
    }
}
exports.AgentRegistry = AgentRegistry;
//# sourceMappingURL=AgentRegistry.js.map