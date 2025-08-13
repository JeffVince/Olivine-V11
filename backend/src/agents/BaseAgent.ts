import { QueueService, SupportedQueueName } from '../services/queues/QueueService'
import { LogService } from '../services/agent/LogService'
import { v4 as uuidv4 } from 'uuid'
import winston from 'winston'
import { EventEmitter } from 'events'

export interface AgentContext {
  orgId: string
  userId?: string
  sessionId?: string
  permissions?: string[]
}

export interface AgentLifecycle {
  start(): Promise<void>
  stop(): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  isRunning(): boolean
  getStatus(): AgentStatus
  getHealthCheck(): Promise<AgentHealthCheck>
}

export interface AgentStatus {
  name: string
  running: boolean
  paused: boolean
  error?: string
  startTime?: Date
  lastActivity?: Date
  processedJobs: number
  failedJobs: number
}

export interface AgentHealthCheck {
  healthy: boolean
  uptime: number
  memoryUsage: NodeJS.MemoryUsage
  queueConnections: boolean
  lastError?: string
  performance: {
    averageJobTime: number
    jobsPerMinute: number
  }
}

export interface AgentConfig {
  maxRetries: number
  retryDelay: number
  healthCheckInterval: number
  enableMonitoring: boolean
  logLevel: string
}

export abstract class BaseAgent extends EventEmitter implements AgentLifecycle {
  protected readonly name: string
  protected readonly queueService: QueueService
  protected readonly logger: winston.Logger
  protected readonly logService: LogService
  protected readonly config: AgentConfig
  
  protected running = false
  protected paused = false
  protected startTime?: Date
  protected lastActivity?: Date
  protected processedJobs = 0
  protected failedJobs = 0
  protected errorCount = 0
  protected lastError?: string
  protected healthCheckTimer?: NodeJS.Timeout
  protected performanceMetrics: {
    jobTimes: number[]
    lastMinuteJobs: Date[]
  } = { jobTimes: [], lastMinuteJobs: [] }

  constructor(name: string, queueService: QueueService, config?: Partial<AgentConfig>) {
    super()
    this.name = name
    this.queueService = queueService
    this.logService = new LogService()
    
    // Default configuration
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      healthCheckInterval: 30000, // 30 seconds
      enableMonitoring: true,
      logLevel: 'info',
      ...config
    }
    
    // Initialize logger for this agent
    this.logger = winston.createLogger({
      level: this.config.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.label({ label: `agent:${this.name}` })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    })
  }

  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn(`Agent ${this.name} is already running`)
      return
    }

    try {
      this.logger.info(`Starting agent ${this.name}`)
      this.startTime = new Date()
      this.lastActivity = new Date()
      this.running = true
      this.paused = false
      this.lastError = undefined

      // Start health check monitoring
      if (this.config.enableMonitoring) {
        this.startHealthCheckMonitoring()
      }

      await this.onStart()
      
      this.logger.info(`Agent ${this.name} started successfully`)
      
      // Log agent start event
      await this.logEvent('agent_started', { 
        agentName: this.name,
        startTime: this.startTime 
      })
      
    } catch (error) {
      this.running = false
      this.lastError = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to start agent ${this.name}:`, error)
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.running) {
      this.logger.warn(`Agent ${this.name} is not running`)
      return
    }

    try {
      this.logger.info(`Stopping agent ${this.name}`)
      
      // Stop health check monitoring
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer)
        this.healthCheckTimer = undefined
      }

      await this.onStop()
      this.running = false
      this.paused = false
      
      this.logger.info(`Agent ${this.name} stopped successfully`)
      
      // Log agent stop event
      await this.logEvent('agent_stopped', { 
        agentName: this.name,
        uptime: this.getUptime()
      })
      
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to stop agent ${this.name}:`, error)
      throw error
    }
  }

  async pause(): Promise<void> {
    if (!this.running || this.paused) {
      this.logger.warn(`Agent ${this.name} cannot be paused in current state`)
      return
    }

    try {
      this.logger.info(`Pausing agent ${this.name}`)
      this.paused = true
      await this.onPause()
      
      // Log agent pause event
      await this.logEvent('agent_paused', { 
        agentName: this.name 
      })
      
    } catch (error) {
      this.paused = false
      this.lastError = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to pause agent ${this.name}:`, error)
      throw error
    }
  }

  async resume(): Promise<void> {
    if (!this.running || !this.paused) {
      this.logger.warn(`Agent ${this.name} cannot be resumed in current state`)
      return
    }

    try {
      this.logger.info(`Resuming agent ${this.name}`)
      this.paused = false
      await this.onResume()
      
      // Log agent resume event
      await this.logEvent('agent_resumed', { 
        agentName: this.name 
      })
      
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to resume agent ${this.name}:`, error)
      throw error
    }
  }

  isRunning(): boolean {
    return this.running && !this.paused
  }

  getName(): string {
    return this.name
  }

  getStatus(): AgentStatus {
    return {
      name: this.name,
      running: this.running,
      paused: this.paused,
      error: this.lastError,
      startTime: this.startTime,
      lastActivity: this.lastActivity,
      processedJobs: this.processedJobs,
      failedJobs: this.failedJobs
    }
  }

  async getHealthCheck(): Promise<AgentHealthCheck> {
    const now = Date.now()
    const oneMinuteAgo = now - 60000
    
    // Filter jobs from last minute
    const recentJobs = this.performanceMetrics.lastMinuteJobs.filter(
      jobTime => jobTime.getTime() > oneMinuteAgo
    )
    
    // Calculate average job time
    const avgJobTime = this.performanceMetrics.jobTimes.length > 0
      ? this.performanceMetrics.jobTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.jobTimes.length
      : 0

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
    }
  }

  /**
   * Execute a job with error handling, retry logic, and monitoring
   */
  protected async executeJob<T>(
    jobName: string,
    jobData: any,
    context: AgentContext,
    handler: () => Promise<T>
  ): Promise<T> {
    const jobId = uuidv4()
    const startTime = Date.now()
    let attempt = 0
    
    this.logger.debug(`Starting job ${jobName}`, { jobId, jobData, context })
    
    while (attempt < this.config.maxRetries) {
      try {
        // Update activity timestamp
        this.lastActivity = new Date()
        
        // Execute the job
        const result = await handler()
        
        // Record success metrics
        const duration = Date.now() - startTime
        this.recordJobSuccess(duration)
        
        this.logger.info(`Job ${jobName} completed successfully`, { 
          jobId, 
          duration,
          attempt: attempt + 1
        })
        
        // Log successful job execution
        await this.logEvent('job_completed', {
          agentName: this.name,
          jobId,
          jobName,
          duration,
          context
        })
        
        return result
        
      } catch (error) {
        attempt++
        const isLastAttempt = attempt >= this.config.maxRetries
        
        this.logger.error(`Job ${jobName} failed (attempt ${attempt}/${this.config.maxRetries})`, {
          jobId,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        })
        
        if (isLastAttempt) {
          // Record failure metrics
          this.recordJobFailure()
          this.lastError = error instanceof Error ? error.message : 'Unknown error'
          
          // Log failed job execution
          await this.logEvent('job_failed', {
            agentName: this.name,
            jobId,
            jobName,
            error: this.lastError,
            attempts: attempt,
            context
          })
          
          throw error
        } else {
          // Wait before retry
          await this.sleep(this.config.retryDelay * attempt)
        }
      }
    }
    
    throw new Error(`Job ${jobName} failed after ${this.config.maxRetries} attempts`)
  }

  /**
   * Validate tenant context for multi-tenant operations
   */
  protected validateContext(context: AgentContext): void {
    if (!context.orgId) {
      throw new Error('Agent context missing required orgId')
    }
    
    // Additional context validation can be added here
    this.logger.debug(`Validated context for org ${context.orgId}`)
  }

  /**
   * Create a new commit for agent operations with provenance tracking
   */
  protected async createCommit(
    orgId: string, 
    message: string, 
    metadata?: any
  ): Promise<string> {
    // This would integrate with the actual commit service
    // For now, return a UUID as placeholder
    const commitId = uuidv4()
    
    await this.logEvent('commit_created', {
      agentName: this.name,
      commitId,
      orgId,
      message,
      metadata
    })
    
    return commitId
  }

  private async logEvent(eventType: string, data: any): Promise<void> {
    try {
      await this.logService.appendLog({
        jobId: uuidv4(),
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `${eventType}: ${JSON.stringify(data)}`
      })
    } catch (error) {
      this.logger.error('Failed to log event:', error)
    }
  }

  private getUptime(): number {
    return this.startTime ? Date.now() - this.startTime.getTime() : 0
  }

  private async checkQueueConnections(): Promise<boolean> {
    try {
      // This would check if queue connections are healthy
      // For now, return true as placeholder
      return true
    } catch (error) {
      return false
    }
  }

  private recordJobSuccess(duration: number): void {
    this.processedJobs++
    this.performanceMetrics.jobTimes.push(duration)
    this.performanceMetrics.lastMinuteJobs.push(new Date())
    
    // Keep only last 100 job times for averaging
    if (this.performanceMetrics.jobTimes.length > 100) {
      this.performanceMetrics.jobTimes.shift()
    }
  }

  private recordJobFailure(): void {
    this.failedJobs++
    this.errorCount++
  }

  private startHealthCheckMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.getHealthCheck()
        if (!health.healthy) {
          this.logger.warn(`Agent ${this.name} health check failed`, health)
        }
      } catch (error) {
        this.logger.error(`Health check failed for agent ${this.name}:`, error)
      }
    }, this.config.healthCheckInterval)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Abstract methods that must be implemented by concrete agents
  protected abstract onStart(): Promise<void>
  protected abstract onStop(): Promise<void>
  protected abstract onPause(): Promise<void>
  protected abstract onResume(): Promise<void>
}


