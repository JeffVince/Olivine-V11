import { ref, watch } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'
import { useProjectStore } from '@/stores/projectStore'

interface Project {
  id: string
  orgId: string
  title: string
  status: string
  createdAt?: string
  updatedAt?: string
}

const LIST_PROJECTS = gql`
  query Projects($orgId: ID!) {
    projects(orgId: $orgId) {
      id
      title
      status
      createdAt
      updatedAt
    }
  }
`

export function useProjects() {
  const orgStore = useOrganizationStore()
  const projectStore = useProjectStore()
  const variables = ref({ orgId: orgStore.currentOrg?.id || '' })
  const { result, loading, refetch } = useQuery(LIST_PROJECTS, variables)
  const items = ref<Project[]>([])

  watch(() => orgStore.currentOrg?.id, (newOrgId: string | undefined) => {
    variables.value.orgId = newOrgId || ''
  })

  watch(result, (newResult: typeof result.value) => {
    if (newResult?.projects) {
      items.value = newResult.projects
      projectStore.setProjects(newResult.projects)
    }
  })

  function selectProject(id: string) {
    projectStore.setProject(id)
  }

  return { items, loading, refetch, selectProject }
}
