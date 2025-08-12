import { BaseAgent } from '../agents/BaseAgent'
import { FileStewardAgent } from '../agents/FileStewardAgent'
import { TaxonomyClassificationAgent } from '../agents/TaxonomyClassificationAgent'
import { ProvenanceTrackingAgent } from '../agents/ProvenanceTrackingAgent'
import { SyncAgent } from '../agents/SyncAgent'
import { QueueService } from './queues/QueueService'
import { Logger } from 'winston'
import * as winston from 'winston'

export class AgentRegistry {
  // TODO: Implementation Plan - 06-Agent-System-Implementation.md - Agent registry implementation with Winston logging
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend agent registry tests
  private static instance: AgentRegistry
  private agents: Map<string, BaseAgent> = new Map()
  private logger: Logger
  private queueService: QueueService

  private constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}] AgentRegistry: ${message}`
        })
      ),
      transports: [
        new winston.transports.Console()
      ]
    })
    // Note: QueueService should be injected, not accessed via getInstance
    // For now, using a placeholder
    this.queueService = {} as QueueService
  }

  public static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry()
    }
    return AgentRegistry.instance
  }

  /**
   * Initialize and register all available agents
   */
  public async initializeAgents(): Promise<void> {
    this.logger.info('Initializing agent registry...')

    try {
      // Initialize File Steward Agent
      const fileStewardAgent = new FileStewardAgent(this.queueService)
      this.registerAgent('file-steward-agent', fileStewardAgent)

      // Initialize taxonomy classification agent
      const taxonomyAgent = new TaxonomyClassificationAgent(this.queueService)
      this.registerAgent('taxonomy-agent', taxonomyAgent)
      
      // Initialize provenance tracking agent
      const provenanceAgent = new ProvenanceTrackingAgent(this.queueService)
      this.registerAgent('provenance-agent', provenanceAgent)
      
      // Initialize sync agent
      const syncAgent = new SyncAgent(this.queueService)
      this.registerAgent('sync-agent', syncAgent)

      this.logger.info(`Registered ${this.agents.size} agents`)
    } catch (error) {
      this.logger.error('Failed to initialize agents:', error)
      throw error
    }
  }

  /**
   * Register a new agent with the registry
   */
  public registerAgent(name: string, agent: BaseAgent): void {
    if (this.agents.has(name)) {
      this.logger.warn(`Agent ${name} is already registered, replacing...`)
    }
    
    this.agents.set(name, agent)
    this.logger.info(`Registered agent: ${name}`)
  }

  /**
   * Start all registered agents
   */
  public async startAllAgents(): Promise<void> {
    this.logger.info('Starting all agents...')
    
    const startPromises = Array.from(this.agents.entries()).map(async ([name, agent]) => {
      try {
        await agent.start()
        this.logger.info(`Started agent: ${name}`)
      } catch (error) {
        this.logger.error(`Failed to start agent ${name}:`, error)
        throw error
      }
    })

    await Promise.all(startPromises)
    this.logger.info('All agents started successfully')
  }

  /**
   * Stop all registered agents
   */
  public async stopAllAgents(): Promise<void> {
    this.logger.info('Stopping all agents...')
    
    const stopPromises = Array.from(this.agents.entries()).map(async ([name, agent]) => {
      try {
        await agent.stop()
        this.logger.info(`Stopped agent: ${name}`)
      } catch (error) {
        this.logger.error(`Failed to stop agent ${name}:`, error)
      }
    })

    await Promise.all(stopPromises)
    this.logger.info('All agents stopped')
  }

  /**
   * Start a specific agent by name
   */
  public async startAgent(name: string): Promise<void> {
    const agent = this.agents.get(name)
    if (!agent) {
      throw new Error(`Agent ${name} not found`)
    }

    await agent.start()
    this.logger.info(`Started agent: ${name}`)
  }

  /**
   * Stop a specific agent by name
   */
  public async stopAgent(name: string): Promise<void> {
    const agent = this.agents.get(name)
    if (!agent) {
      throw new Error(`Agent ${name} not found`)
    }

    await agent.stop()
    this.logger.info(`Stopped agent: ${name}`)
  }

  /**
   * Pause a specific agent by name
   */
  public async pauseAgent(name: string): Promise<void> {
    const agent = this.agents.get(name)
    if (!agent) {
      throw new Error(`Agent ${name} not found`)
    }

    await agent.pause()
    this.logger.info(`Paused agent: ${name}`)
  }

  /**
   * Resume a specific agent by name
   */
  public async resumeAgent(name: string): Promise<void> {
    const agent = this.agents.get(name)
    if (!agent) {
      throw new Error(`Agent ${name} not found`)
    }

    await agent.resume()
    this.logger.info(`Resumed agent: ${name}`)
  }

  /**
   * Get all registered agents
   */
  public getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values())
  }

  /**
   * Get all active (running) agents
   */
  public getActiveAgents(): BaseAgent[] {
    return Array.from(this.agents.values()).filter(agent => agent.isRunning())
  }

  /**
   * Get a specific agent by name
   */
  public getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name)
  }

  /**
   * Get agent status summary
   */
  public getAgentStatus(): { [key: string]: boolean } {
    const status: { [key: string]: boolean } = {}
    
    for (const [name, agent] of this.agents.entries()) {
      status[name] = agent.isRunning()
    }
    
    return status
  }

  /**
   * Health check for all agents
   */
  public async performHealthCheck(): Promise<{
    healthy: boolean
    agents: { [key: string]: { running: boolean; error?: string } }
  }> {
    const result = {
      healthy: true,
      agents: {} as { [key: string]: { running: boolean; error?: string } }
    }

    for (const [name, agent] of this.agents.entries()) {
      try {
        const running = agent.isRunning()
        result.agents[name] = { running }
        
        if (!running) {
          result.healthy = false
        }
      } catch (error) {
        result.agents[name] = { 
          running: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
        result.healthy = false
      }
    }

    return result
  }

  /**
   * Graceful shutdown of all agents
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down agent registry...')
    
    try {
      await this.stopAllAgents()
      this.agents.clear()
      this.logger.info('Agent registry shutdown complete')
    } catch (error) {
      this.logger.error('Error during agent registry shutdown:', error)
      throw error
    }
  }
}
