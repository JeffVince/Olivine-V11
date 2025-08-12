import { ref, watchEffect } from 'vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'

const LIST_REVIEWS = gql`
  query TaskReviews($orgId: ID!, $limit: Int, $offset: Int) {
    taskReviews(orgId: $orgId, limit: $limit, offset: $offset) {
      id
      type
      orgId
      status
      createdAt
      targetId
      context
    }
  }
`

const APPROVE = gql`
  mutation ApproveReview($orgId: ID!, $id: ID!) {
    approveTaskReview(orgId: $orgId, id: $id) { id status }
  }
`
const REJECT = gql`
  mutation RejectReview($orgId: ID!, $id: ID!, $reason: String) {
    rejectTaskReview(orgId: $orgId, id: $id, reason: $reason) { id status }
  }
`

export function useApprovals() {
  const org = useOrganizationStore()
  const variables = ref({ orgId: org.currentOrg?.id || '', limit: 100, offset: 0 })
  const { result, loading, refetch } = useQuery(LIST_REVIEWS, variables)
  const { mutate: approve } = useMutation(APPROVE)
  const { mutate: reject } = useMutation(REJECT)
  const items = ref<any[]>([])

  watchEffect(() => { variables.value.orgId = org.currentOrg?.id || '' })
  watchEffect(() => { if (result.value?.taskReviews) items.value = result.value.taskReviews })

  return { items, loading, refetch, approve, reject }
}


