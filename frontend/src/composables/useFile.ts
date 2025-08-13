import { ref, watch } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'

interface File {
  id: string
  name: string
  path: string
  size: number
  mimeType: string
  checksum: string
  modified: string
  metadata: Record<string, unknown>
  classificationStatus: string
  classificationConfidence: number
  canonicalSlot: string
  extractedText: string
  current: boolean
  deleted: boolean
}

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
      classificationStatus
      classificationConfidence
      canonicalSlot
      extractedText
      current
      deleted
    }
  }
`

export function useFile(fileId: () => string | null) {
  const orgStore = useOrganizationStore()
  const variables = ref<{ orgId: string; id: string } | null>(null)
  const { result, loading, refetch } = useQuery(FILE_QUERY, variables, () => ({ enabled: !!variables.value }))
  const data = ref<File | null>(null)

  watch([() => orgStore.currentOrg?.id, fileId], ([orgId, id]) => {
    if (orgId && id) variables.value = { orgId, id }
    else variables.value = null
  })

  watch(result, () => {
    data.value = result.value?.file || null
  })

  return { data, loading, refetch }
}


