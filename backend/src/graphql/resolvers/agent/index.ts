import { buildAgentJobResolvers } from './jobs'
import { buildHealthResolvers } from './health'
import { QueueService } from '../../../services/queues/QueueService'

export function buildAgentResolvers(queueService: QueueService) {
  const jobs = buildAgentJobResolvers(queueService)
  const health = buildHealthResolvers(queueService)
  return {
    Query: {
      ...(jobs.Query || {}),
      ...(health.Query || {}),
    },
    Mutation: {
      ...(jobs.Mutation || {}),
    },
    Subscription: {
      ...(jobs.Subscription || {}),
    },
  }
}


