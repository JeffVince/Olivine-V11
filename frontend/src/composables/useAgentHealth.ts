import { ref } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import gql from 'graphql-tag'

export interface QueueData {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

const AGENT_HEALTH = gql`
  query AgentHealth($orgId: ID!) {
    agentHealth(orgId: $orgId) {
      status
      agents
    }
    queues(orgId: $orgId) {
      name
      waiting
      active
      completed
      failed
      delayed
    }
  }
`

export function useAgentHealth(orgIdRef: { value: string }) {
  const status = ref<'ok' | 'degraded' | 'unknown'>('unknown')
  const agents = ref<string[]>([])
  const queues = ref<QueueData[]>([])

  const { onResult, refetch } = useQuery(AGENT_HEALTH, () => ({ orgId: orgIdRef.value }))
  onResult((r: { data?: { agentHealth?: { status: 'ok' | 'degraded' | 'unknown'; agents: string[] }; queues: QueueData[] } }) => {
    status.value = r.data?.agentHealth?.status ?? 'unknown'
    agents.value = r.data?.agentHealth?.agents ?? []
    queues.value = r.data?.queues ?? []
  })

  return { status, agents, queues, refetch }
}


