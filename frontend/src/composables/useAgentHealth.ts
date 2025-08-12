import { ref, watchEffect } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import gql from 'graphql-tag'

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

export function useAgentHealth(orgIdRef: any) {
  const status = ref<'ok' | 'degraded' | 'unknown'>('unknown')
  const agents = ref<string[]>([])
  const queues = ref<any[]>([])

  const { onResult, refetch } = useQuery(AGENT_HEALTH, () => ({ orgId: orgIdRef.value }))
  onResult((r) => {
    status.value = r.data?.agentHealth?.status ?? 'unknown'
    agents.value = r.data?.agentHealth?.agents ?? []
    queues.value = r.data?.queues ?? []
  })

  return { status, agents, queues, refetch }
}


