import { ref, watchEffect } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'
import { useProjectStore } from '@/stores/projectStore'

const LIST_PROJECTS = gql`
  query Projects($orgId: ID!) {
    projects(filter: { status: "ACTIVE" }, limit: 100, offset: 0) {
      id
      name
      status
    }
  }
`

export function useProjects() {
  const orgStore = useOrganizationStore()
  const projectStore = useProjectStore()
  const variables = ref({ orgId: orgStore.currentOrg?.id || '' })
  const { result, loading, refetch } = useQuery(LIST_PROJECTS, variables)
  const items = ref<any[]>([])

  watchEffect(() => {
    variables.value.orgId = orgStore.currentOrg?.id || ''
  })

  watchEffect(() => {
    if (result.value?.projects) items.value = result.value.projects
  })

  function selectProject(id: string) {
    projectStore.setProject(id)
  }

  return { items, loading, refetch, selectProject }
}


