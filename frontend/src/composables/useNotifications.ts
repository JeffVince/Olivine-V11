import { useSubscription } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'
import { useNotificationStore } from '@/stores/notificationStore'

interface FileUpdated {
  id: string
  name: string
  path: string
}

interface CommitCreated {
  id: string
  message: string
  createdAt: string
}

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

  const { onResult: onFileUpdate } = useSubscription(FILE_UPDATED_SUB, () => ({ orgId: orgStore.currentOrg?.id || '' }))
  onFileUpdate((data: { data?: { fileUpdated: FileUpdated } }) => {
    const file = data?.data?.fileUpdated
    if (!file) return
    notifications.add('info', `File updated: ${file.name}`, '/projects')
  })

  const { onResult: onCommitCreated } = useSubscription(COMMIT_CREATED_SUB, () => ({ orgId: orgStore.currentOrg?.id || '' }))
  onCommitCreated((data: { data?: { commitCreated: CommitCreated } }) => {
    const commit = data?.data?.commitCreated
    if (!commit) return
    notifications.add('success', `New commit: ${commit.message}`, '/projects')
  })
}


