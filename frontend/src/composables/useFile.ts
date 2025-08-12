import { ref, watch } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'

const FILE_QUERY = gql`
  query File($orgId: ID!, $id: ID!) {
    file(orgId: $orgId, id: $id) {
      id
      name
      path
      size
      mimeType
      checksum
      modified
      metadata
      current
      deleted
    }
  }
`

export function useFile(fileId: () => string | null) {
  const orgStore = useOrganizationStore()
  const variables = ref<{ orgId: string; id: string } | null>(null)
  const { result, loading, refetch } = useQuery(FILE_QUERY, variables, () => ({ enabled: !!variables.value }))
  const data = ref<any | null>(null)

  watch([() => orgStore.currentOrg?.id, fileId], ([orgId, id]) => {
    if (orgId && id) variables.value = { orgId, id }
    else variables.value = null
  })

  watch(result, () => {
    data.value = result.value?.file || null
  })

  return { data, loading, refetch }
}


