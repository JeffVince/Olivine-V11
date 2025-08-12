import { BaseAgent, AgentConfig } from './BaseAgent';
import { FileStewardAgent } from './FileStewardAgent';
import { TaxonomyClassificationAgent } from './TaxonomyClassificationAgent';
import { ProvenanceTrackingAgent } from './ProvenanceTrackingAgent';
import { SyncAgent } from './SyncAgent';
import { QueueService } from '../services/queues/QueueService';
import { Neo4jService } from '../services/Neo4jService';
import { PostgresService } from '../services/PostgresService';
import { EventEmitter } from 'events';
import winston from 'winston';

export interface AgentMetadata {
  id: string;
  name: string;
  type: string;
  status: 'starting' | 'running' | 'paused' | 'stopping' | 'stopped' | 'error';
  instance: BaseAgent;
  config: Partial<AgentConfig>;
  startedAt?: Date;
  lastHeartbeat?: Date;
  errorCount: number;
  processingStats: {
    jobsProcessed: number;
    jobsSucceeded: number;
    jobsFailed: number;
    avgProcessingTime: number;
  };
}

export interface AgentDiscovery {
  registeredAgents: string[];
  activeAgents: string[];
  availableAgents: string[];
  systemHealth: 'healthy' | 'degraded' | 'critical';
}

export class AgentRegistry extends EventEmitter {
  private agents: Map<string, AgentMetadata>;
  private queueService: QueueService;
  private neo4jService: Neo4jService;
  private postgresService: PostgresService;
  private logger: winston.Logger;
  private heartbeatInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private scalingCheckInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.agents = new Map();
    this.queueService = new QueueService();
    this.neo4jService = new Neo4jService();
    this.postgresService = new PostgresService();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.label({ label: 'agent-registry' })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/agent-registry.log',
          format: winston.format.json()
        })
      ]
    });
  }

  /**
   * Initialize the Agent Registry and start core agents
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Agent Registry...');

    try {
      // Initialize services
      await this.queueService.connect();
      await this.neo4jService.connect();
      await this.postgresService.connect();

      // Register and start core agents
      await this.registerCoreAgents();

      // Start monitoring systems
      this.startHeartbeatMonitoring();
      this.startHealthChecking();
      this.startScalingMonitoring();

      this.logger.info('Agent Registry initialized successfully');
      this.emit('registry-initialized');

    } catch (error) {
      this.logger.error('Failed to initialize Agent Registry:', error);
      throw error;
    }
  }

  /**
   * Register all core system agents
   */
  private async registerCoreAgents(): Promise<void> {
    this.logger.info('Registering core agents...');

    const agentConfigs = [
      {
        type: 'file-steward',
        class: FileStewardAgent,
        config: { 
          maxConcurrentJobs: 5,
          retryAttempts: 3,
          retryDelay: 5000
        }
      },
      {
        type: 'taxonomy-classification',
        class: TaxonomyClassificationAgent,
        config: { 
          maxConcurrentJobs: 10,
          retryAttempts: 2,
          retryDelay: 3000
        }
      },
      {
        type: 'provenance-tracking',
        class: ProvenanceTrackingAgent,
        config: { 
          maxConcurrentJobs: 15,
          retryAttempts: 3,
          retryDelay: 2000
        }
      },
      {
        type: 'sync',
        class: SyncAgent,
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

  /**
   * Register a new agent instance
   */
  async registerAgent(
    agentType: string,
    AgentClass: new (queueService: QueueService, config?: Partial<AgentConfig>) => BaseAgent,
    config: Partial<AgentConfig> = {}
  ): Promise<string> {
    const agentId = `${agentType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.info(`Registering agent: ${agentType} (${agentId})`);

    try {
      // Create agent instance
      const agentInstance = new AgentClass(this.queueService, config);

      // Register agent metadata
      const agentMetadata: AgentMetadata = {
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

      // Set up agent event listeners
      this.setupAgentListeners(agentId, agentInstance);

      // Auto-start the agent
      await this.startAgent(agentId);

      this.logger.info(`Agent registered and started: ${agentType} (${agentId})`);
      this.emit('agent-registered', { agentId, agentType });

      return agentId;

    } catch (error) {
      this.logger.error(`Failed to register agent ${agentType}:`, error);
      throw error;
    }
  }

  /**
   * Start an agent by ID
   */
  async startAgent(agentId: string): Promise<void> {
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

    } catch (error) {
      agentMeta.status = 'error';
      agentMeta.errorCount++;
      
      this.logger.error(`Failed to start agent ${agentId}:`, error);
      this.emit('agent-error', { agentId, error: error instanceof Error ? error.message : 'Unknown error' });
      
      throw error;
    }
  }

  /**
   * Stop an agent by ID
   */
  async stopAgent(agentId: string): Promise<void> {
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

    } catch (error) {
      agentMeta.status = 'error';
      agentMeta.errorCount++;
      
      this.logger.error(`Failed to stop agent ${agentId}:`, error);
      this.emit('agent-error', { agentId, error: error instanceof Error ? error.message : 'Unknown error' });
      
      throw error;
    }
  }

  /**
   * Pause an agent by ID
   */
  async pauseAgent(agentId: string): Promise<void> {
    const agentMeta = this.agents.get(agentId);
    if (!agentMeta) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    this.logger.info(`Pausing agent: ${agentId}`);

    try {
      await agentMeta.instance.pause();
      agentMeta.status = 'paused';
      
      this.emit('agent-paused', { agentId, agentType: agentMeta.type });

    } catch (error) {
      agentMeta.errorCount++;
      this.logger.error(`Failed to pause agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Resume a paused agent by ID
   */
  async resumeAgent(agentId: string): Promise<void> {
    const agentMeta = this.agents.get(agentId);
    if (!agentMeta) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    this.logger.info(`Resuming agent: ${agentId}`);

    try {
      await agentMeta.instance.resume();
      agentMeta.status = 'running';
      
      this.emit('agent-resumed', { agentId, agentType: agentMeta.type });

    } catch (error) {
      agentMeta.errorCount++;
      this.logger.error(`Failed to resume agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Restart an agent by ID
   */
  async restartAgent(agentId: string): Promise<void> {
    this.logger.info(`Restarting agent: ${agentId}`);

    try {
      await this.stopAgent(agentId);
      // Small delay to ensure clean shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.startAgent(agentId);

      this.emit('agent-restarted', { agentId });

    } catch (error) {
      this.logger.error(`Failed to restart agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Remove an agent from the registry
   */
  async removeAgent(agentId: string): Promise<void> {
    const agentMeta = this.agents.get(agentId);
    if (!agentMeta) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    this.logger.info(`Removing agent: ${agentId}`);

    try {
      // Stop the agent if it's running
      if (agentMeta.status === 'running') {
        await this.stopAgent(agentId);
      }

      // Remove from registry
      this.agents.delete(agentId);
      
      this.logger.info(`Agent removed: ${agentId}`);
      this.emit('agent-removed', { agentId, agentType: agentMeta.type });

    } catch (error) {
      this.logger.error(`Failed to remove agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get agent discovery information
   */
  getAgentDiscovery(): AgentDiscovery {
    const registeredAgents = Array.from(this.agents.keys());
    const activeAgents = registeredAgents.filter(id => {
      const agent = this.agents.get(id);
      return agent?.status === 'running';
    });

    // Available agents are types that can be instantiated
    const availableAgents = [
      'file-steward',
      'taxonomy-classification',
      'provenance-tracking',
      'sync'
    ];

    // Determine system health
    let systemHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
    
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

  /**
   * Get agent metadata by ID
   */
  getAgent(agentId: string): AgentMetadata | null {
    return this.agents.get(agentId) || null;
  }

  /**
   * Get all agents metadata
   */
  getAllAgents(): AgentMetadata[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by type
   */
  getAgentsByType(agentType: string): AgentMetadata[] {
    return Array.from(this.agents.values()).filter(agent => agent.type === agentType);
  }

  /**
   * Get system statistics
   */
  getSystemStats(): any {
    const agents = Array.from(this.agents.values());
    
    return {
      totalAgents: agents.length,
      runningAgents: agents.filter(a => a.status === 'running').length,
      pausedAgents: agents.filter(a => a.status === 'paused').length,
      errorAgents: agents.filter(a => a.status === 'error').length,
      totalJobsProcessed: agents.reduce((sum, a) => sum + a.processingStats.jobsProcessed, 0),
      totalJobsSucceeded: agents.reduce((sum, a) => sum + a.processingStats.jobsSucceeded, 0),
      totalJobsFailed: agents.reduce((sum, a) => sum + a.processingStats.jobsFailed, 0),
      avgProcessingTime: agents.reduce((sum, a, _, arr) => 
        sum + (a.processingStats.avgProcessingTime / arr.length), 0
      ),
      systemUptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Set up event listeners for agent instances
   */
  private setupAgentListeners(agentId: string, agentInstance: BaseAgent): void {
    // Forward agent events to registry events
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

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [agentId, agentMeta] of this.agents.entries()) {
        if (agentMeta.status === 'running') {
          agentMeta.lastHeartbeat = new Date();
        }
      }
    }, 30 * 1000); // Every 30 seconds
  }

  /**
   * Start health checking
   */
  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [agentId, agentMeta] of this.agents.entries()) {
        try {
          // Check if agent is responsive
          if (agentMeta.status === 'running' && agentMeta.instance.isRunning()) {
            // Agent health check passed
            continue;
          }

          // If agent should be running but isn't, try to restart it
          if (agentMeta.status === 'running' && !agentMeta.instance.isRunning()) {
            this.logger.warn(`Agent ${agentId} appears unhealthy, restarting...`);
            await this.restartAgent(agentId);
          }

        } catch (error) {
          this.logger.error(`Health check failed for agent ${agentId}:`, error);
        }
      }
    }, 60 * 1000); // Every minute
  }

  /**
   * Start scaling monitoring (for future auto-scaling features)
   */
  private startScalingMonitoring(): void {
    this.scalingCheckInterval = setInterval(() => {
      // Future: Implement auto-scaling logic based on queue lengths and agent performance
      // For now, just log current status
      const stats = this.getSystemStats();
      this.logger.debug('System stats:', stats);
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Shutdown the entire agent registry
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Agent Registry...');

    try {
      // Clear intervals
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
      if (this.scalingCheckInterval) clearInterval(this.scalingCheckInterval);

      // Stop all agents
      const stopPromises = Array.from(this.agents.keys()).map(agentId => 
        this.stopAgent(agentId).catch(error => 
          this.logger.error(`Error stopping agent ${agentId}:`, error)
        )
      );

      await Promise.all(stopPromises);

      // Close service connections
      await this.queueService.close();
      await this.neo4jService.close();
      await this.postgresService.close();

      this.logger.info('Agent Registry shut down successfully');
      this.emit('registry-shutdown');

    } catch (error) {
      this.logger.error('Error during Agent Registry shutdown:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const agentRegistry = new AgentRegistry();
