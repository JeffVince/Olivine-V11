"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AgentRegistry_1 = require("../../services/AgentRegistry");
const FileStewardAgent_1 = require("../../agents/FileStewardAgent");
const TaxonomyClassificationAgent_1 = require("../../agents/TaxonomyClassificationAgent");
const ProvenanceTrackingAgent_1 = require("../../agents/ProvenanceTrackingAgent");
const SyncAgent_1 = require("../../agents/SyncAgent");
jest.mock('../../agents/FileStewardAgent');
jest.mock('../../agents/TaxonomyClassificationAgent');
jest.mock('../../agents/ProvenanceTrackingAgent');
jest.mock('../../agents/SyncAgent');
describe('AgentRegistry', () => {
    let agentRegistry;
    let mockQueueService;
    beforeEach(() => {
        jest.clearAllMocks();
        mockQueueService = {
            getQueue: jest.fn(),
            addJob: jest.fn(),
            registerWorker: jest.fn(),
            getQueueEvents: jest.fn(),
            close: jest.fn()
        };
        AgentRegistry_1.AgentRegistry.instance = null;
        agentRegistry = AgentRegistry_1.AgentRegistry.getInstance();
        agentRegistry.queueService = mockQueueService;
        agentRegistry.agents.clear();
    });
    describe('getInstance', () => {
        it('should return the same instance', () => {
            const instance1 = AgentRegistry_1.AgentRegistry.getInstance();
            const instance2 = AgentRegistry_1.AgentRegistry.getInstance();
            expect(instance1).toBe(instance2);
        });
    });
    describe('initializeAgents', () => {
        it('should register all agent types', async () => {
            await agentRegistry.initializeAgents();
            expect(FileStewardAgent_1.FileStewardAgent).toHaveBeenCalled();
            expect(TaxonomyClassificationAgent_1.TaxonomyClassificationAgent).toHaveBeenCalled();
            expect(ProvenanceTrackingAgent_1.ProvenanceTrackingAgent).toHaveBeenCalled();
            expect(SyncAgent_1.SyncAgent).toHaveBeenCalled();
            expect(agentRegistry.getAllAgents()).toHaveLength(4);
            expect(agentRegistry.getAgent('file-steward-agent')).toBeDefined();
            expect(agentRegistry.getAgent('taxonomy-agent')).toBeDefined();
            expect(agentRegistry.getAgent('provenance-agent')).toBeDefined();
            expect(agentRegistry.getAgent('sync-agent')).toBeDefined();
        });
    });
    describe('registerAgent', () => {
        it('should add agent to registry', () => {
            const mockAgent = {};
            agentRegistry.registerAgent('test-agent', mockAgent);
            expect(agentRegistry.getAgent('test-agent')).toBe(mockAgent);
        });
        it('should replace existing agent with same name', () => {
            const mockAgent1 = {};
            const mockAgent2 = {};
            agentRegistry.registerAgent('test-agent', mockAgent1);
            agentRegistry.registerAgent('test-agent', mockAgent2);
            expect(agentRegistry.getAgent('test-agent')).toBe(mockAgent2);
        });
    });
    describe('getAllAgents', () => {
        it('should return all registered agents', async () => {
            await agentRegistry.initializeAgents();
            const agents = agentRegistry.getAllAgents();
            expect(agents).toHaveLength(4);
        });
    });
    describe('getAgent', () => {
        it('should return specific agent by name', async () => {
            await agentRegistry.initializeAgents();
            const agent = agentRegistry.getAgent('file-steward-agent');
            expect(agent).toBeDefined();
        });
        it('should return undefined for non-existent agent', () => {
            const agent = agentRegistry.getAgent('non-existent-agent');
            expect(agent).toBeUndefined();
        });
    });
    describe('startAllAgents', () => {
        it('should call start on all agents', async () => {
            await agentRegistry.initializeAgents();
            const mockStart = jest.fn().mockResolvedValue(undefined);
            const agents = agentRegistry.getAllAgents();
            agents.forEach(agent => {
                agent.start = mockStart;
            });
            await agentRegistry.startAllAgents();
            expect(mockStart).toHaveBeenCalledTimes(4);
        });
    });
    describe('stopAllAgents', () => {
        it('should call stop on all agents', async () => {
            await agentRegistry.initializeAgents();
            const mockStop = jest.fn().mockResolvedValue(undefined);
            const agents = agentRegistry.getAllAgents();
            agents.forEach(agent => {
                agent.stop = mockStop;
            });
            await agentRegistry.stopAllAgents();
            expect(mockStop).toHaveBeenCalledTimes(4);
        });
    });
    describe('startAgent', () => {
        it('should call start on specific agent', async () => {
            await agentRegistry.initializeAgents();
            const mockStart = jest.fn().mockResolvedValue(undefined);
            const agent = agentRegistry.getAgent('file-steward-agent');
            if (agent) {
                agent.start = mockStart;
                await agentRegistry.startAgent('file-steward-agent');
            }
            expect(mockStart).toHaveBeenCalled();
        });
        it('should throw error for non-existent agent', async () => {
            await expect(agentRegistry.startAgent('non-existent-agent'))
                .rejects.toThrow('Agent non-existent-agent not found');
        });
    });
    describe('stopAgent', () => {
        it('should call stop on specific agent', async () => {
            await agentRegistry.initializeAgents();
            const mockStop = jest.fn().mockResolvedValue(undefined);
            const agent = agentRegistry.getAgent('file-steward-agent');
            if (agent) {
                agent.stop = mockStop;
                await agentRegistry.stopAgent('file-steward-agent');
            }
            expect(mockStop).toHaveBeenCalled();
        });
        it('should throw error for non-existent agent', async () => {
            await expect(agentRegistry.stopAgent('non-existent-agent'))
                .rejects.toThrow('Agent non-existent-agent not found');
        });
    });
    describe('pauseAgent', () => {
        it('should call pause on specific agent', async () => {
            await agentRegistry.initializeAgents();
            const mockPause = jest.fn().mockResolvedValue(undefined);
            const agent = agentRegistry.getAgent('file-steward-agent');
            if (agent) {
                agent.pause = mockPause;
                await agentRegistry.pauseAgent('file-steward-agent');
            }
            expect(mockPause).toHaveBeenCalled();
        });
        it('should throw error for non-existent agent', async () => {
            await expect(agentRegistry.pauseAgent('non-existent-agent'))
                .rejects.toThrow('Agent non-existent-agent not found');
        });
    });
    describe('resumeAgent', () => {
        it('should call resume on specific agent', async () => {
            await agentRegistry.initializeAgents();
            const mockResume = jest.fn().mockResolvedValue(undefined);
            const agent = agentRegistry.getAgent('file-steward-agent');
            if (agent) {
                agent.resume = mockResume;
                await agentRegistry.resumeAgent('file-steward-agent');
            }
            expect(mockResume).toHaveBeenCalled();
        });
        it('should throw error for non-existent agent', async () => {
            await expect(agentRegistry.resumeAgent('non-existent-agent'))
                .rejects.toThrow('Agent non-existent-agent not found');
        });
    });
    describe('performHealthCheck', () => {
        it('should return health status for all agents', async () => {
            await agentRegistry.initializeAgents();
            const mockIsRunning = jest.fn().mockReturnValue(true);
            const agents = agentRegistry.getAllAgents();
            agents.forEach(agent => {
                agent.isRunning = mockIsRunning;
            });
            const healthStatus = await agentRegistry.performHealthCheck();
            expect(healthStatus.healthy).toBe(true);
            expect(Object.keys(healthStatus.agents)).toHaveLength(4);
        });
    });
    describe('shutdown', () => {
        it('should stop all agents and clear registry', async () => {
            await agentRegistry.initializeAgents();
            const mockStop = jest.fn().mockResolvedValue(undefined);
            const agents = agentRegistry.getAllAgents();
            agents.forEach(agent => {
                agent.stop = mockStop;
            });
            await agentRegistry.shutdown();
            expect(mockStop).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=AgentRegistry.test.js.map