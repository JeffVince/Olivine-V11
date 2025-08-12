import { QueueService } from '../../services/queues/QueueService'
import { LogService } from '../../services/agent/LogService'

interface AgentJob {
  id: string
  orgId: string
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
        orgId: string
        status?: string
        type?: string
        limit?: number
        offset?: number
      },
      context: any
    ): Promise<AgentJob[]> => {
      const { orgId, status, type, limit = 50, offset = 0 } = args
      
      // Validate organization access
      if (context.user.orgId !== orgId) {
        throw new Error('Unauthorized access to organization data')
      }

      // Note: QueueService instance should be passed from context or dependency injection
      // For now, using a placeholder implementation
      const jobs: any[] = []

      return jobs.map((job: any) => ({
        id: job.id,
        orgId: job.data.orgId,
        type: job.data.type || job.name,
        target: job.data.target || job.data.resourcePath || '',
        status: job.opts.delay ? 'delayed' : 
                job.finishedOn ? (job.failedReason ? 'failed' : 'completed') :
                job.processedOn ? 'active' : 'waiting',
        priority: job.opts.priority || 0,
        attemptsMade: job.attemptsMade || 0,
        retries: job.opts.attempts || 0,
        worker: job.processedBy,
        startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
        durationMs: job.finishedOn && job.processedOn ? 
                   job.finishedOn - job.processedOn : undefined,
        params: job.data
      }))
    },

    // Get agent health status
    agentHealth: async (
      _: any,
      args: { orgId: string },
      context: any
    ): Promise<AgentHealthStatus> => {
      const { orgId } = args
      
      // Validate organization access
      if (context.user.orgId !== orgId) {
        throw new Error('Unauthorized access to organization data')
      }

      // Note: AgentRegistry instance should be passed from context or dependency injection
      // For now, using a placeholder implementation
      const runningAgents: any[] = []
      const allCriticalRunning = false

      return {
        status: allCriticalRunning ? 'ok' : 'degraded',
        agents: runningAgents.map((agent: any) => agent.name)
      }
    },

    // Get queue statistics
    queues: async (
      _: any,
      args: { orgId: string },
      context: any
    ): Promise<QueueStats[]> => {
      const { orgId } = args
      
      // Validate organization access
      if (context.user.orgId !== orgId) {
        throw new Error('Unauthorized access to organization data')
      }

      // Note: QueueService instance should be passed from context
      // For now, using a placeholder implementation
      const queueNames = ['file-sync', 'file-classification', 'provenance', 'content-extraction']
      
      const stats = queueNames.map((name) => ({
        name,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0
      }))

      return stats
    }
  },

  Mutation: {
    // Enqueue a new agent job
    enqueueAgentJob: async (
      _: any,
      args: {
        input: {
          orgId: string
          type: string
          target: string
          params: any
          priority?: number
        }
      },
      context: any
    ) => {
      const { orgId, type, target, params, priority = 0 } = args.input
      
      // Validate organization access
      if (context.user.orgId !== orgId) {
        throw new Error('Unauthorized access to organization data')
      }

      // Note: QueueService instance should be passed from context
      // For now, using a placeholder implementation
      
      // Determine which queue to use based on job type
      const queueMap: { [key: string]: string } = {
        'file-sync': 'file-sync',
        'file-classification': 'file-classification',
        'content-extraction': 'content-extraction',
        'provenance': 'provenance'
      }

      const queueName = queueMap[type] || 'file-sync'
      
      // Placeholder job creation
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      return {
        id: jobId,
        type,
        status: 'waiting'
      }
    },

    // Cancel an agent job
    cancelAgentJob: async (
      _: any,
      args: { orgId: string; id: string },
      context: any
    ): Promise<boolean> => {
      const { orgId, id } = args
      
      // Validate organization access
      if (context.user.orgId !== orgId) {
        throw new Error('Unauthorized access to organization data')
      }

      // Note: QueueService instance should be passed from context
      // For now, using a placeholder implementation
      
      try {
        // Placeholder job cancellation
        console.log(`Cancelling job ${id} for org ${orgId}`)
        return true
      } catch (error) {
        console.error('Failed to cancel job:', error)
        return false
      }
    }
  },

  Subscription: {
    // Subscribe to job updates for an organization
    jobUpdated: {
      subscribe: async (_: any, args: { orgId: string }, context: any) => {
        const { orgId } = args
        
        // Validate organization access
        if (context.user.orgId !== orgId) {
          throw new Error('Unauthorized access to organization data')
        }

        // Return subscription iterator for job updates
        // This would typically use Redis pub/sub or similar
        const queueService = QueueService.getInstance()
        return queueService.subscribeToJobUpdates(orgId)
      }
    }
  }
}
