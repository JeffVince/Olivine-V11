import { Queue, Worker, QueueOptions, JobsOptions, Processor, WorkerOptions, Job, QueueEvents } from 'bullmq'
import IORedis, { Redis } from 'ioredis'

export type SupportedQueueName =
  | 'file-sync'
  | 'file-classification'
  | 'content-extraction'
  | 'provenance'
  | 'agent-jobs'
  | 'create-commit'
  | 'create-action'
  | 'create-version'
  | 'webhook-events'
  | 'source-sync'
  | 'delta-sync'

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
  public readonly connection: Redis
  private readonly queues: Map<SupportedQueueName, Queue>
  private readonly queueEvents: Map<SupportedQueueName, QueueEvents>
  private readonly prefix: string

  constructor(config?: QueueServiceConfig) {
    const defaultConfig = {
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      prefix: 'olivine'
    };
    const finalConfig = { ...defaultConfig, ...config };
    
    this.connection = new IORedis(finalConfig.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
    this.queues = new Map()
    this.queueEvents = new Map()
    this.prefix = finalConfig.prefix

    // Initialize standard queues
    ;(
      [
        'file-sync',
        'file-classification',
        'content-extraction',
        'provenance',
        'agent-jobs',
        'create-commit',
        'create-action',
        'create-version',
        'webhook-events',
        'source-sync',
        'delta-sync',
      ] as SupportedQueueName[]
    ).forEach((name) => this.ensureQueue(name))
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
    const queue = this.ensureQueue(name)
    return queue.add(jobName, data, options)
  }

  public registerWorker<T = any, R = any>(
    name: SupportedQueueName,
    processor: Processor<T, R>,
    options?: WorkerOptions,
  ): Worker<T, R> {
    const worker = new Worker<T, R>(this.fullQueueName(name), processor, {
      connection: this.connection,
      concurrency: 5,
      ...options,
    })
    return worker
  }

  public getQueueEvents(name: SupportedQueueName): QueueEvents {
    let events = this.queueEvents.get(name)
    if (!events) {
      events = new QueueEvents(this.fullQueueName(name), { connection: this.connection })
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
    await this.ping();
  }

  public async close(): Promise<void> {
    this.queues.forEach(async (q) => await q.close());
    this.queueEvents.forEach(async (e) => await e.close());
    await this.connection.quit();
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
        connection: this.connection,
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


