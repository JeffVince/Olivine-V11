import { ref, watchEffect } from 'vue'
import { useQuery, useSubscription } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'
import { useProjectStore } from '@/stores/projectStore'

const FILES_QUERY = gql`
  query GetFiles($organizationId: ID!, $sourceId: ID, $limit: Int) {
    getFiles(organizationId: $organizationId, sourceId: $sourceId, limit: $limit) {
      id
      organizationId
      sourceId
      path
      name
      size
      mimeType
      updatedAt
      metadata
      classificationStatus
    }
  }
`

// Placeholder: backend subscriptions not yet implemented for files

export function useFiles() {
  const orgStore = useOrganizationStore()
  const projectStore = useProjectStore()

  const variables = ref({ organizationId: orgStore.currentOrg?.id || '', sourceId: undefined as string | undefined, limit: 100 })

  const { result, loading, refetch, onError } = useQuery(FILES_QUERY, variables)
  const items = ref<any[]>([])

  watchEffect(() => {
    variables.value.organizationId = orgStore.currentOrg?.id || ''
  })

  watchEffect(() => {
    if (result.value?.files) items.value = result.value.files
  })

  // Subscription can be re-enabled once backend publishes file updates

  return { items, loading, refetch, onError }
}


