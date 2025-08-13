import Redis from 'ioredis';
import { config } from 'dotenv';

// Load environment variables
config();

export interface Job {
  id: string;
  data: unknown;
  priority: number;
  createdAt: string;
  status: string;
}

export class QueueService {
  // TODO: Implementation Plan - 06-Agent-System-Implementation.md - Queue service implementation
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend queue service tests
  private redis: Redis;
  private subscriber: Redis;

  constructor() {
    // Main Redis connection for queue operations
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      lazyConnect: true
    });

    // Subscriber connection for listening to queue events
    this.subscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      lazyConnect: true
    });
  }

  /**
   * Add a job to the specified queue
   * @param queueName Name of the queue
   * @param jobData Job data to be processed
   * @param priority Job priority (optional)
   * @returns Job ID
   * 
   * // TODO: Implementation Plan - 06-Agent-System-Implementation.md - Job queueing implementation
   * // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend job queueing tests
   */
  async addJob(queueName: string, jobData: unknown, priority?: number): Promise<string> {
    const jobId = this.generateJobId();
    const job = {
      id: jobId,
      data: jobData,
      priority: priority || 0,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    try {
      await this.redis.lpush(`queue:${queueName}`, JSON.stringify(job));
      return jobId;
    } catch (error) {
      console.error(`Error adding job to queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Process jobs from the specified queue
   * @param queueName Name of the queue
   * @param processor Function to process jobs
   * @param concurrency Number of concurrent workers (optional)
   */
  async processQueue(queueName: string, processor: (job: unknown) => Promise<void>, concurrency = 1): Promise<void> {
    const workers = [];
    
    for (let i = 0; i < concurrency; i++) {
      workers.push(this.createWorker(queueName, processor));
    }
    
    // Start all workers
    await Promise.all(workers);
  }

  /**
   * Create a worker to process jobs from the queue
   * @param queueName Name of the queue
   * @param processor Function to process jobs
   */
  private async createWorker(queueName: string, processor: (job: unknown) => Promise<void>): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        // Blocking pop from queue
        const result = await this.redis.brpop(`queue:${queueName}`, 5);
        
        if (result) {
          const [, jobString] = result;
          const job = JSON.parse(jobString);
          
          // Update job status to processing
          job.status = 'processing';
          job.startedAt = new Date().toISOString();
          await this.updateJob(queueName, job);
          
          try {
            // Process the job
            await processor(job);
            
            // Update job status to completed
            job.status = 'completed';
            job.completedAt = new Date().toISOString();
            await this.updateJob(queueName, job);
          } catch (error) {
            // Update job status to failed
            job.status = 'failed';
            job.failedAt = new Date().toISOString();
            job.error = (error as Error).message;
            await this.updateJob(queueName, job);
            
            console.error(`Error processing job ${job.id}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error in queue worker for ${queueName}:`, error);
        // Wait a bit before retrying to avoid busy loop on errors
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Update job status in the queue
   * @param queueName Name of the queue
   * @param job Updated job object
   */
  private async updateJob(queueName: string, job: Job): Promise<void> {
    // For simplicity, we're just logging the update
    // In a real implementation, you might want to store job status in a separate hash
    console.log(`Job ${job.id} in queue ${queueName} updated to status: ${job.status}`);
  }

  /**
   * Get queue statistics
   * @param queueName Name of the queue
   * @returns Queue statistics
   */
  async getQueueStats(queueName: string): Promise<Record<string, unknown>> {
    try {
      const length = await this.redis.llen(`queue:${queueName}`);
      return {
        queueName,
        length
      };
    } catch (error) {
      console.error(`Error getting queue stats for ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Health check for Redis connection
   * @returns Boolean indicating if connection is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Close Redis connections
   */
  async close(): Promise<void> {
    await this.redis.quit();
    await this.subscriber.quit();
  }

  /**
   * Generate a unique job ID
   * @returns Unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
