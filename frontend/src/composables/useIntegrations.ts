import { ref } from 'vue'
import { useMutation } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'

const TRIGGER_SYNC = gql`
  mutation TriggerSourceResync($orgId: ID!, $sourceId: ID!) {
    triggerSourceResync(orgId: $orgId, sourceId: $sourceId)
  }
`

export function useIntegrations() {
  const syncing = ref(false)
  const { mutate, onError, onDone } = useMutation(TRIGGER_SYNC)
  const orgStore = useOrganizationStore()

  async function triggerSync(sourceId: string) {
    syncing.value = true
    try {
      const orgId = orgStore.currentOrg?.id || '00000000-0000-0000-0000-000000000000'
      await mutate({ orgId, sourceId })
    } finally {
      syncing.value = false
    }
  }

  return { triggerSync, syncing, onError, onDone }
}


