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
const winston = __importStar(require("winston"));
class AgentRegistry {
    constructor() {
        this.agents = new Map();
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.printf(({ timestamp, level, message }) => {
                return `${timestamp} [${level}] AgentRegistry: ${message}`;
            })),
            transports: [
                new winston.transports.Console()
            ]
        });
        this.queueService = {};
    }
    static getInstance() {
        if (!AgentRegistry.instance) {
            AgentRegistry.instance = new AgentRegistry();
        }
        return AgentRegistry.instance;
    }
    async initializeAgents() {
        this.logger.info('Initializing agent registry...');
        try {
            const fileStewardAgent = new FileStewardAgent_1.FileStewardAgent(this.queueService);
            this.registerAgent('file-steward-agent', fileStewardAgent);
            const taxonomyAgent = new TaxonomyClassificationAgent_1.TaxonomyClassificationAgent(this.queueService);
            this.registerAgent('taxonomy-agent', taxonomyAgent);
            const provenanceAgent = new ProvenanceTrackingAgent_1.ProvenanceTrackingAgent(this.queueService);
            this.registerAgent('provenance-agent', provenanceAgent);
            const syncAgent = new SyncAgent_1.SyncAgent(this.queueService);
            this.registerAgent('sync-agent', syncAgent);
            this.logger.info(`Registered ${this.agents.size} agents`);
        }
        catch (error) {
            this.logger.error('Failed to initialize agents:', error);
            throw error;
        }
    }
    registerAgent(name, agent) {
        if (this.agents.has(name)) {
            this.logger.warn(`Agent ${name} is already registered, replacing...`);
        }
        this.agents.set(name, agent);
        this.logger.info(`Registered agent: ${name}`);
    }
    async startAllAgents() {
        this.logger.info('Starting all agents...');
        const startPromises = Array.from(this.agents.entries()).map(async ([name, agent]) => {
            try {
                await agent.start();
                this.logger.info(`Started agent: ${name}`);
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
                await agent.stop();
                this.logger.info(`Stopped agent: ${name}`);
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
            throw new Error(`Agent ${name} not found`);
        }
        await agent.start();
        this.logger.info(`Started agent: ${name}`);
    }
    async stopAgent(name) {
        const agent = this.agents.get(name);
        if (!agent) {
            throw new Error(`Agent ${name} not found`);
        }
        await agent.stop();
        this.logger.info(`Stopped agent: ${name}`);
    }
    async pauseAgent(name) {
        const agent = this.agents.get(name);
        if (!agent) {
            throw new Error(`Agent ${name} not found`);
        }
        await agent.pause();
        this.logger.info(`Paused agent: ${name}`);
    }
    async resumeAgent(name) {
        const agent = this.agents.get(name);
        if (!agent) {
            throw new Error(`Agent ${name} not found`);
        }
        await agent.resume();
        this.logger.info(`Resumed agent: ${name}`);
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
    getAgentStatus() {
        const status = {};
        for (const [name, agent] of this.agents.entries()) {
            status[name] = agent.isRunning();
        }
        return status;
    }
    async performHealthCheck() {
        const result = {
            healthy: true,
            agents: {}
        };
        for (const [name, agent] of this.agents.entries()) {
            try {
                const running = agent.isRunning();
                result.agents[name] = { running };
                if (!running) {
                    result.healthy = false;
                }
            }
            catch (error) {
                result.agents[name] = {
                    running: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
                result.healthy = false;
            }
        }
        return result;
    }
    async shutdown() {
        this.logger.info('Shutting down agent registry...');
        try {
            await this.stopAllAgents();
            this.agents.clear();
            this.logger.info('Agent registry shutdown complete');
        }
        catch (error) {
            this.logger.error('Error during agent registry shutdown:', error);
            throw error;
        }
    }
}
exports.AgentRegistry = AgentRegistry;
//# sourceMappingURL=AgentRegistry.js.map