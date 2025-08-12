import { AgentRegistry } from '../../services/AgentRegistry';
import { BaseAgent } from '../../agents/BaseAgent';
import { FileStewardAgent } from '../../agents/FileStewardAgent';
import { TaxonomyClassificationAgent } from '../../agents/TaxonomyClassificationAgent';
import { ProvenanceTrackingAgent } from '../../agents/ProvenanceTrackingAgent';
import { SyncAgent } from '../../agents/SyncAgent';

// Mock agents
jest.mock('../../agents/FileStewardAgent');
jest.mock('../../agents/TaxonomyClassificationAgent');
jest.mock('../../agents/ProvenanceTrackingAgent');
jest.mock('../../agents/SyncAgent');

describe('AgentRegistry', () => {
  let agentRegistry: AgentRegistry;
  let mockQueueService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock queue service
    mockQueueService = {
      getQueue: jest.fn(),
      addJob: jest.fn(),
      registerWorker: jest.fn(),
      getQueueEvents: jest.fn(),
      close: jest.fn()
    };
    
    // Reset the singleton instance
    (AgentRegistry as any).instance = null;
    
    // Get the singleton instance and inject the queue service
    agentRegistry = AgentRegistry.getInstance();
    (agentRegistry as any).queueService = mockQueueService;
    
    // Clear agents map between tests
    (agentRegistry as any).agents.clear();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = AgentRegistry.getInstance();
      const instance2 = AgentRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('initializeAgents', () => {
    it('should register all agent types', async () => {
      await agentRegistry.initializeAgents();
      
      expect(FileStewardAgent).toHaveBeenCalled();
      expect(TaxonomyClassificationAgent).toHaveBeenCalled();
      expect(ProvenanceTrackingAgent).toHaveBeenCalled();
      expect(SyncAgent).toHaveBeenCalled();
      
      expect(agentRegistry.getAllAgents()).toHaveLength(4);
      expect(agentRegistry.getAgent('file-steward-agent')).toBeDefined();
      expect(agentRegistry.getAgent('taxonomy-agent')).toBeDefined();
      expect(agentRegistry.getAgent('provenance-agent')).toBeDefined();
      expect(agentRegistry.getAgent('sync-agent')).toBeDefined();
    });
  });

  describe('registerAgent', () => {
    it('should add agent to registry', () => {
      const mockAgent = {} as BaseAgent;
      
      agentRegistry.registerAgent('test-agent', mockAgent);
      
      expect(agentRegistry.getAgent('test-agent')).toBe(mockAgent);
    });

    it('should replace existing agent with same name', () => {
      const mockAgent1 = {} as BaseAgent;
      const mockAgent2 = {} as BaseAgent;
      
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
        (agent as any).start = mockStart;
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
        (agent as any).stop = mockStop;
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
        (agent as any).start = mockStart;
        
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
        (agent as any).stop = mockStop;
        
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
        (agent as any).pause = mockPause;
        
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
        (agent as any).resume = mockResume;
        
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
        (agent as any).isRunning = mockIsRunning;
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
        (agent as any).stop = mockStop;
      });
      
      await agentRegistry.shutdown();
      
      expect(mockStop).toHaveBeenCalled();
    });
  });
});
