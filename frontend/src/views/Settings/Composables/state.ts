import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import type { Profile, NotificationSettings, ProjectOptions } from './Interface'

// State - Single source of truth for all reactive variables
export const tab = ref('profile')

const auth = useAuthStore()
const projectStore = useProjectStore()
const route = useRoute()

export const profile = ref<Profile>({
  name: auth.user?.name || '',
  avatar: auth.user?.avatar || '',
})

export const notif = ref<NotificationSettings>({
  email: auth.notificationPrefs?.email || false,
  sms: auth.notificationPrefs?.sms || false,
  inApp: auth.notificationPrefs?.inApp || false,
})

export const projectOptions = ref<ProjectOptions>({
  name: '',
  templates: [] as string[],
  autoApprove: false,
})

export const nameRules = [(v: string) => !!v || 'Name is required']
export const urlRules = [
  (v: string) => !v || /^https?:\/\//.test(v) || 'Must be a valid URL',
]

// Initialize data
export async function initializeSettings() {
  if (!projectStore.projects.length) await projectStore.fetchProjects()
  const project = projectStore.projects.find(p => p.id === (route.params.id as string))
  if (project) {
    projectOptions.value.name = project.name
    projectOptions.value.templates = project.settings?.templates || []
    projectOptions.value.autoApprove = project.settings?.autoApprove || false
  }
}

// Lifecycle
export function useSettingsLifecycle() {
  onMounted(async () => {
    await initializeSettings()
  })
}
