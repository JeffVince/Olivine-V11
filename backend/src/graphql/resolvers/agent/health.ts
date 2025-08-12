import { QueueService } from '../../../services/queues/QueueService'
import { Neo4jService } from '../../../services/Neo4jService'

export function buildHealthResolvers(queueService: QueueService) {
  const neo4j = new Neo4jService()
  return {
    Query: {
      agentHealth: async () => {
        const redisOk = await queueService.ping().then(() => true).catch(() => false)
        const neo4jOk = await neo4j.healthCheck()
        return {
          status: redisOk && neo4jOk ? 'ok' : 'degraded',
          agents: ['file-steward-agent', 'taxonomy-classification-agent', 'provenance-tracking-agent', 'sync-agent'],
        }
      },
    },
  }
}


