import { QueueService } from '../../services/queues/QueueService'
import { JobService } from '../../services/agent/JobService'
import { LogService } from '../../services/agent/LogService'

interface AgentJob {
  id: string
  organizationId: string
  type: string
  target: string
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  priority: number
  attemptsMade: number
  retries: number
  worker?: string
  startedAt?: Date
  finishedAt?: Date
  durationMs?: number
  params: any
}

interface AgentHealthStatus {
  status: 'ok' | 'degraded' | 'unknown'
  agents: string[]
}

interface QueueStats {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

export const agentResolvers = {
  Query: {
    // Get list of agent jobs for an organization
    agentJobs: async (
      _: any,
      args: {
        organizationId: string
        status?: string
        type?: string
        limit?: number
        offset?: number
      },
      context: any
    ): Promise<AgentJob[]> => {
      const { organizationId, status, type, limit = 50, offset = 0 } = args
      
      // Validate organization access
      if (context.user.organizationId !== organizationId) {
        throw new Error('Unauthorized access to organization jobs')
      }

      const jobService = new JobService(new QueueService())
      const jobs = await jobService.listAgentJobs({ status, type, limit, offset })
      
      return jobs.map((job: any) => ({
        id: job.id,
        organizationId: job.data.organizationId,
        type: job.name,
        target: job.data.target || job.data.sceneId || job.data.characterId || job.data.projectId,
        status: job.status,
        priority: job.priority,
        attemptsMade: job.attemptsMade,
        retries: job.opts.attempts - job.attemptsMade - 1,
        worker: job.progress?.worker,
        startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
        durationMs: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : undefined,
        params: job.data.params || {}
      }))
    },

    // Get agent health status
    agentHealth: async (
      _: any,
      args: { organizationId: string },
      context: any
    ): Promise<AgentHealthStatus> => {
      const { organizationId } = args
      
      // Validate organization access
      if (context.user.organizationId !== organizationId) {
        throw new Error('Unauthorized access to organization health')
      }
      
      // Health check implementation - placeholder for now
      return { status: 'ok', agents: [] }
    },

    // Get queue statistics
    queues: async (
      _: any,
      args: { organizationId: string },
      context: any
    ): Promise<QueueStats[]> => {
      const { organizationId } = args
      
      // Validate organization access
      if (context.user.organizationId !== organizationId) {
        throw new Error('Unauthorized access to organization queues')
      }
      
      const jobService = new JobService(new QueueService())
      return await jobService.getQueueStats()
    }
  },

  Mutation: {
    // Enqueue a new agent job
    enqueueAgentJob: async (
      _: any,
      args: {
        input: {
          organizationId: string
          type: string
          target: string
          params: any
          priority?: number
        }
      },
      context: any
    ) => {
      const { organizationId, type, target, params, priority = 0 } = args.input
      
      // Validate organization access
      if (context.user.organizationId !== organizationId) {
        throw new Error('Unauthorized access to organization jobs')
      }
      
      const jobService = new JobService(new QueueService())
      const job = await jobService.enqueueAgentJob({ orgId: organizationId, type, target, params, priority })
      return { id: job.id, success: true }
    },

    // Cancel an agent job
    cancelAgentJob: async (
      _: any,
      args: { organizationId: string; id: string },
      context: any
    ): Promise<boolean> => {
      const { organizationId, id } = args
      
      // Validate organization access
      if (context.user.organizationId !== organizationId) {
        throw new Error('Unauthorized access to organization jobs')
      }
      
      const jobService = new JobService(new QueueService())
      console.log(`Cancelling job ${id} for org ${organizationId}`)
      return await jobService.cancelAgentJob(id)
    }
  },

  Subscription: {
    // Subscribe to job updates for an organization
    jobUpdated: {
      subscribe: async (_: any, args: { organizationId: string }, context: any) => {
        const { organizationId } = args
        
        // Validate organization access
        if (context.user.organizationId !== organizationId) {
          throw new Error('Unauthorized access to organization job updates')
        }
        
        const queueService = new QueueService()
        return queueService.subscribeToJobUpdates(organizationId)
      }
    }
  }
}
