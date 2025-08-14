import { QueueService } from '../../../services/queues/QueueService'
import { JobService } from '../../../services/agent/JobService'
import { RunbookService } from '../../../services/agent/RunbookService'
import { pubsub, TOPICS } from '../../../services/graphql/PubSub'

export function buildAgentJobResolvers(queueService: QueueService) {
  const jobService = new JobService(queueService)
  const runbookService = new RunbookService()
  return {
    Query: {
      agentJobs: async (_: any, args: any) => jobService.listAgentJobs({ status: args.status, type: args.type, limit: args.limit, offset: args.offset }),
      agentJob: async (_: any, args: any) => jobService.getAgentJob(args.id),
      runbooks: async (_: any, args: any) => runbookService.list(args.organizationId),
      queues: async () => jobService.getQueueStats(),
      agentHealth: async () => {
        // Basic health info; extend with Neo4j/Redis checks
        return {
          status: 'ok',
          agents: ['file-steward-agent', 'taxonomy-classification-agent', 'provenance-tracking-agent', 'sync-agent'],
        }
      },
    },
    Mutation: {
      enqueueAgentJob: async (_: any, { input }: any) => {
        const job = await jobService.enqueueAgentJob(input)
        await pubsub.publish(TOPICS.JobUpdated, { jobUpdated: job })
        return job
      },
      cancelAgentJob: async (_: any, { id }: any) => jobService.cancelAgentJob(id),
      saveRunbook: async (_: any, { input }: any) => runbookService.save(input),
      executeRunbook: async (_: any, { organizationId, id, params }: any) => jobService.enqueueAgentJob({ orgId: organizationId, type: 'custom', target: id, params }),
    },
    Subscription: {
      jobUpdated: {
        subscribe: () => pubsub.asyncIterator([TOPICS.JobUpdated]),
      },
      jobLogAppended: {
        subscribe: () => pubsub.asyncIterator([TOPICS.JobLogAppended]),
      },
    },
  }
}


