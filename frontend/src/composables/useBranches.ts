import { ref, watchEffect } from 'vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'

interface Branch {
  id: string
  name: string
  description: string
  active: boolean
  baseCommitId: string
}

const LIST_BRANCHES = gql`
  query Branches($orgId: ID!) { branches(orgId: $orgId) { id name description active baseCommitId } }
`

const CREATE_BRANCH = gql`
  mutation CreateBranch($orgId: ID!, $name: String!, $description: String) { createBranch(input: { orgId: $orgId, name: $name, description: $description }) { id } }
`

const MERGE_BRANCH = gql`
  mutation MergeBranch($orgId: ID!, $source: String!, $target: String!, $message: String!, $author: String!) {
    mergeBranch(input: { orgId: $orgId, sourceBranch: $source, targetBranch: $target, mergeMessage: $message, author: $author }) { id }
  }
`

export function useBranches() {
  const org = useOrganizationStore()
  const variables = ref({ orgId: org.currentOrg?.id || '' })
  const { result, loading, refetch } = useQuery(LIST_BRANCHES, variables)
  const branches = ref<Branch[]>([])

  watchEffect(() => { variables.value.orgId = org.currentOrg?.id || '' })
  watchEffect(() => { if (result.value?.branches) branches.value = result.value.branches })

  const { mutate: create } = useMutation(CREATE_BRANCH)
  const { mutate: merge } = useMutation(MERGE_BRANCH)

  return { branches, loading, refetch, create, merge }
}


