import { QueueService, SupportedQueueName } from './QueueService'
import { pubsub, TOPICS } from '../graphql/PubSub'
import { mapBullJob } from '../agent/JobMapper'

export class QueueMonitor {
  // TODO: Implementation Plan - 01-Foundation-Setup.md - Queue monitoring implementation
  // TODO: Implementation Plan - 06-Agent-System-Implementation.md - Agent job queue monitoring
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend queue monitoring tests
  private readonly queues: SupportedQueueName[] = [
    'agent-jobs',
    'file-sync',
    'file-classification',
    'content-extraction',
    'provenance',
  ]

  constructor(private readonly queueService: QueueService) {}

  start(): void {
    for (const name of this.queues) {
      const events = this.queueService.getQueueEvents(name)
      const queue = this.queueService.getQueue(name)

      events.on('active', async ({ jobId }) => {
        const job = await queue.getJob(jobId)
        if (job) await pubsub.publish(TOPICS.JobUpdated, { jobUpdated: mapBullJob(job) })
      })
      events.on('completed', async ({ jobId }) => {
        const job = await queue.getJob(jobId)
        if (job) await pubsub.publish(TOPICS.JobUpdated, { jobUpdated: mapBullJob(job) })
      })
      events.on('failed', async ({ jobId }) => {
        const job = await queue.getJob(jobId)
        if (job) await pubsub.publish(TOPICS.JobUpdated, { jobUpdated: mapBullJob(job) })
      })
    }
  }
}


