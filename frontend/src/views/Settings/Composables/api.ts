import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useProjectStore } from '@/stores/projectStore'
import type { Profile, NotificationSettings } from './Interface'

const auth = useAuthStore()
const notifications = useNotificationStore()
const projectStore = useProjectStore()

export async function saveProfile(profile: Profile) {
  try {
    await auth.updateProfile(profile)
    notifications.add('success', 'Profile updated')
  } catch (e) {
    notifications.add('error', 'Failed to update profile')
    throw e
  }
}

export async function saveNotifications(notif: NotificationSettings) {
  try {
    await auth.updateNotificationPrefs(notif)
    notifications.add('success', 'Notification preferences saved')
  } catch (e) {
    notifications.add('error', 'Failed to save notifications')
    throw e
  }
}

export async function saveProject(projectId: string, projectOptions: any) {
  try {
    await projectStore.updateProjectOptions(projectId, {
      name: projectOptions.name,
      templates: projectOptions.templates,
      autoApprove: projectOptions.autoApprove,
    })
    notifications.add('success', 'Project settings saved')
  } catch (e) {
    notifications.add('error', 'Failed to save project settings')
    throw e
  }
}
