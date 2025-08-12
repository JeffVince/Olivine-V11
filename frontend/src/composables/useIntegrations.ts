import { ref } from 'vue'
import { useMutation } from '@vue/apollo-composable'
import gql from 'graphql-tag'

const TRIGGER_SYNC = gql`
  mutation TriggerSync($sourceId: ID!) {
    triggerSync(sourceId: $sourceId) {
      success
      message
    }
  }
`

export function useIntegrations() {
  const syncing = ref(false)
  const { mutate, onError, onDone } = useMutation(TRIGGER_SYNC)

  async function triggerSync(sourceId: string) {
    syncing.value = true
    try {
      await mutate({ sourceId })
    } finally {
      syncing.value = false
    }
  }

  return { triggerSync, syncing, onError, onDone }
}


