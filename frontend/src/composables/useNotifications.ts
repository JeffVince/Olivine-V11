import { useSubscription } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'
import { useNotificationStore } from '@/stores/notificationStore'

const FILE_UPDATED_SUB = gql`
  subscription FileUpdated($orgId: ID!) {
    fileUpdated(orgId: $orgId) {
      id
      name
      path
    }
  }
`

const COMMIT_CREATED_SUB = gql`
  subscription CommitCreated($orgId: ID!) {
    commitCreated(orgId: $orgId) {
      id
      message
      createdAt
    }
  }
`

export function useNotifications() {
  const orgStore = useOrganizationStore()
  const notifications = useNotificationStore()

  useSubscription(FILE_UPDATED_SUB, () => ({ orgId: orgStore.currentOrg?.id || '' }), {
    onNext: (data) => {
      const file = data?.data?.fileUpdated
      if (!file) return
      notifications.add('info', `File updated: ${file.name}`, '/projects')
    },
  })

  useSubscription(COMMIT_CREATED_SUB, () => ({ orgId: orgStore.currentOrg?.id || '' }), {
    onNext: (data) => {
      const commit = data?.data?.commitCreated
      if (!commit) return
      notifications.add('success', `New commit: ${commit.message}`, '/projects')
    },
  })
}


