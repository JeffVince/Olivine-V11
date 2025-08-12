import { ref, watchEffect } from 'vue'
import { useQuery, useSubscription } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'
import { useProjectStore } from '@/stores/projectStore'

const FILES_QUERY = gql`
  query Files($filter: FileFilter, $limit: Int, $offset: Int) {
    files(filter: $filter, limit: $limit, offset: $offset) {
      id
      orgId
      sourceId
      projectId
      path
      name
      size
      mimeType
      updatedAt
      metadata
      classificationStatus
      classificationConfidence
      canonicalSlot
      current
      deleted
    }
  }
`

const FILE_UPDATED_SUB = gql`
  subscription OnFileUpdated($orgId: ID!) {
    fileUpdated(orgId: $orgId) {
      id
      orgId
      sourceId
      projectId
      path
      name
      size
      mimeType
      updatedAt
      metadata
      classificationStatus
      classificationConfidence
      canonicalSlot
      current
      deleted
    }
  }
`

// Placeholder: backend subscriptions not yet implemented for files

export function useFiles() {
  const orgStore = useOrganizationStore()
  const projectStore = useProjectStore()

  const variables = ref({
    filter: {
      orgId: orgStore.currentOrg?.id || '',
      sourceId: undefined as string | undefined,
      classificationStatus: undefined as string | undefined,
      mimeType: undefined as string | undefined,
      path: undefined as string | undefined,
      name: undefined as string | undefined,
    },
    limit: 200,
    offset: 0,
  })

  const { result, loading, refetch, onError } = useQuery(FILES_QUERY, variables)
  const items = ref<any[]>([])

  watchEffect(() => {
    variables.value.filter.orgId = orgStore.currentOrg?.id || ''
  })

  watchEffect(() => {
    if (result.value?.files) items.value = result.value.files
  })

  // Live updates for file changes
  useSubscription(FILE_UPDATED_SUB, () => ({ orgId: orgStore.currentOrg?.id || '' }), {
    onResult: (res) => {
      const updated = res.data?.fileUpdated
      if (!updated) return
      const idx = items.value.findIndex((f) => f.id === updated.id)
      if (idx >= 0) {
        items.value[idx] = { ...items.value[idx], ...updated }
      } else {
        items.value.unshift(updated)
      }
    },
  })

  return { items, loading, refetch, onError, variables }
}


