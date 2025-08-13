import { ref, watchEffect } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'
import { useProjectStore } from '@/stores/projectStore'

interface Commit {
  id: string
  message: string
  createdAt: string
}

const COMMITS = gql`
  query Commits($orgId: ID!, $branchName: String) {
    commits(orgId: $orgId, branchName: $branchName, limit: 50) {
      id
      message
      createdAt
    }
  }
`

export function useCommits() {
  const orgStore = useOrganizationStore()
  const projectStore = useProjectStore()
  const variables = ref({ orgId: orgStore.currentOrg?.id || '', branchName: projectStore.currentBranch })
  const { result, loading, refetch } = useQuery(COMMITS, variables)
  const items = ref<Commit[]>([])

  watchEffect(() => {
    variables.value.orgId = orgStore.currentOrg?.id || ''
    variables.value.branchName = projectStore.currentBranch
  })

  watchEffect(() => {
    if (result.value?.commits) items.value = result.value.commits
  })

  return { items, loading, refetch }
}


