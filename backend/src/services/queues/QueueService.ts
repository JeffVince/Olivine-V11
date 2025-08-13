import { Queue, Worker, QueueOptions, JobsOptions, Processor, WorkerOptions, Job, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'
import type { Redis } from 'ioredis'

export type SupportedQueueName =
  | 'file-sync'
  | 'file-classification'
  | 'content-extraction'
  | 'content-promotion'
  | 'content-rollback'
  | 'ontology-review'
  | 'cluster-orchestration'
  | 'provenance'
  | 'agent-jobs'
  | 'create-commit'
  | 'create-action'
  | 'create-version'
  | 'webhook-events'
  | 'source-sync'
  | 'delta-sync'
  | 'event-bus'
  | 'workflow-execution'
  | 'workflow-coordination'

export interface QueueServiceConfig {
  redisUrl: string
  prefix?: string
}

export class QueueService {
  // TODO: Implementation Plan - 01-Foundation-Setup.md - Queue service implementation with BullMQ
  // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Queue service for file sync operations
  // TODO: Implementation Plan - 06-Agent-System-Implementation.md - Queue service for agent jobs
  // TODO: Implementation Checklist - 01-Foundation-Setup-Checklist.md - Redis queue service setup
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend queue service tests
  private static instance: QueueService | null = null;
  public readonly connection: Redis | null
  private readonly queues: Map<SupportedQueueName, Queue>
  private readonly queueEvents: Map<SupportedQueueName, QueueEvents>
  private readonly inMemoryWorkers: Map<SupportedQueueName, Processor<any, any>>
  private readonly inMemoryQueues: Map<SupportedQueueName, Array<{ jobName: string, data: any }>>
  private readonly prefix: string

  constructor(config?: QueueServiceConfig) {
    const defaultConfig = {
      redisUrl: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}/${process.env.REDIS_DB || '0'}`,
      prefix: 'olivine'
    };
    const finalConfig = { ...defaultConfig, ...config };
    
    console.log('Redis URL being used:', finalConfig.redisUrl);
    
    const isTestMode = process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'test'
    this.connection = isTestMode ? null : new IORedis(finalConfig.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
    this.queues = new Map()
    this.queueEvents = new Map()
    this.inMemoryWorkers = new Map()
    this.inMemoryQueues = new Map()
    this.prefix = finalConfig.prefix

    // Initialize standard queues
    ;(
      [
        'file-sync',
        'file-classification',
        'content-extraction',
          'content-promotion',
          'content-rollback',
          'ontology-review',
          'cluster-orchestration',
        'provenance',
        'agent-jobs',
        'create-commit',
        'create-action',
        'create-version',
        'webhook-events',
        'source-sync',
        'delta-sync',
      ] as SupportedQueueName[]
    ).forEach((name) => {
      if (!isTestMode) this.ensureQueue(name)
      if (isTestMode) {
        this.inMemoryQueues.set(name, [])
      }
    })
  }

  public getQueue(name: SupportedQueueName): Queue {
    return this.ensureQueue(name)
  }

  public async ping(): Promise<string> {
    // @ts-ignore ioredis supports ping
    return this.connection.ping?.() ?? 'PONG'
  }

  public async addJob<T = any>(
    name: SupportedQueueName,
    jobName: string,
    data: T,
    options?: JobsOptions,
  ): Promise<Job<T, any>> {
    const isTestMode = this.connection === null
    if (isTestMode) {
      const jobId = `${name}:${jobName}:${Date.now()}`
      const processor = this.inMemoryWorkers.get(name)
      if (processor) {
        setImmediate(async () => {
          try {
            await processor({ id: jobId, name: jobName, data } as any)
          } catch (e) {
            // swallow in tests
          }
        })
      } else {
        const q = this.inMemoryQueues.get(name)
        q?.push({ jobName, data })
      }
      return { id: jobId } as any
    }
    const queue = this.ensureQueue(name)
    return queue.add(jobName, data, options)
  }

  public registerWorker<T = any, R = any>(
    name: SupportedQueueName,
    processor: Processor<T, R>,
    options?: WorkerOptions,
  ): Worker<T, R> {
    const isTestMode = this.connection === null
    if (isTestMode) {
      this.inMemoryWorkers.set(name, processor as any)
      const pending = this.inMemoryQueues.get(name) || []
      // Drain any queued jobs
      for (const j of pending) {
        setImmediate(() => (processor as any)({ id: `${name}:${Date.now()}`, name: j.jobName, data: j.data }))
      }
      this.inMemoryQueues.set(name, [])
      return { close: async () => {} } as any
    }
    const worker = new Worker<T, R>(this.fullQueueName(name), processor, {
      connection: this.connection!,
      concurrency: 5,
      ...options,
    })
    return worker
  }

  public getQueueEvents(name: SupportedQueueName): QueueEvents {
    const isTestMode = this.connection === null
    if (isTestMode) {
      return { on: () => {}, off: () => {}, close: async () => {} } as any
    }
    let events = this.queueEvents.get(name)
    if (!events) {
      events = new QueueEvents(this.fullQueueName(name), { connection: this.connection! })
      this.queueEvents.set(name, events)
    }
    return events
  }

  public static getInstance(config?: QueueServiceConfig): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService(config);
    }
    return QueueService.instance;
  }

  public async connect(): Promise<void> {
    if (this.connection) {
      await this.ping();
    }
  }

  public async close(): Promise<void> {
    for (const q of this.queues.values()) {
      await q.close()
    }
    for (const e of this.queueEvents.values()) {
      await e.close()
    }
    if (this.connection) {
      await this.connection.quit()
    }
  }

  /**
   * Subscribe to job updates for a specific organization
   * @param orgId Organization ID
   * @returns AsyncIterator for job updates
   */
  public async *subscribeToJobUpdates(orgId: string): AsyncIterableIterator<any> {
    // This is a placeholder implementation
    // In a real implementation, this would stream job updates for the organization
    const queueEvents = this.queueEvents.get('agent-jobs');
    if (queueEvents) {
      // Subscribe to job completion events and filter by orgId
      // For now, return empty iterator
      return;
    }
    
    // Return empty iterator as fallback
    return;
  }

  private ensureQueue(name: SupportedQueueName): Queue {
    let queue = this.queues.get(name)
    if (!queue) {
      const opts: QueueOptions = {
        connection: this.connection!,
        prefix: this.prefix,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 100,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      }
      queue = new Queue(this.fullQueueName(name), opts)
      this.queues.set(name, queue)
    }
    return queue
  }

  private fullQueueName(name: SupportedQueueName): string {
    return name;
  }
}


