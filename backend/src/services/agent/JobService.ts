import { QueueService, SupportedQueueName } from '../queues/QueueService'
import { pubsub, TOPICS } from '../graphql/PubSub'
import { mapBullJob } from './JobMapper'

export type ListFilter = { status?: string; type?: string; limit?: number; offset?: number }

export class JobService {
  // TODO: Implementation Plan - 06-Agent-System-Implementation.md - Agent job service implementation
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend agent job service tests
  private readonly queueService: QueueService

  constructor(queueService: QueueService) {
    this.queueService = queueService
  }

  async listAgentJobs(filter: ListFilter = {}) {
    const queue = this.queueService.getQueue('agent-jobs')
    const limit = filter.limit ?? 50
    const offset = filter.offset ?? 0
    // Pull recent jobs across common states
    const jobs = await queue.getJobs(
      ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'],
      offset,
      offset + limit - 1,
      false,
    )
    return jobs
      .filter((j) => (filter.type ? j.name === filter.type : true))
      .map(mapBullJob)
  }

  async getAgentJob(id: string) {
    const queue = this.queueService.getQueue('agent-jobs')
    const job = await queue.getJob(id)
    return job ? mapBullJob(job) : null
  }

  async enqueueAgentJob(input: { orgId: string; type: string; target?: string; priority?: number; params?: any }) {
    const queue = this.queueService.getQueue('agent-jobs')
    const job = await queue.add(input.type, input, { priority: input.priority ?? 5 })
    const mapped = mapBullJob(job)
    await pubsub.publish(TOPICS.JobUpdated, { jobUpdated: mapped })
    return mapped
  }

  async cancelAgentJob(id: string): Promise<boolean> {
    const queue = this.queueService.getQueue('agent-jobs')
    const job = await queue.getJob(id)
    if (!job) return false
    await job.remove()
    return true
  }

  async getQueueStats(): Promise<{ name: string; waiting: number; active: number; completed: number; failed: number; delayed: number }[]> {
    const queues: SupportedQueueName[] = [
      'agent-jobs',
      'file-sync',
      'file-classification',
      'content-extraction',
      'provenance',
    ]
    const stats = [] as any[]
    for (const name of queues) {
      const q = this.queueService.getQueue(name)
      const counts = await q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')
      stats.push({ name, waiting: counts.waiting, active: counts.active, completed: counts.completed, failed: counts.failed, delayed: counts.delayed })
    }
    return stats
  }

  // status updates handled via pubsub on enqueue; workers can also publish updates as they progress
}


