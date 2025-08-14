import { ref, computed, watch } from 'vue'
import type { Integration, AvailableIntegration, LogEntry } from './Interface'

// State - Single source of truth for all reactive variables
export const showAddDialog = ref(false)
export const showConfigDialog = ref(false)
export const showLogsDialog = ref(false)
export const selectedIntegration = ref<Integration | null>(null)
export const logsIntegration = ref<Integration | null>(null)
export const logs = ref<LogEntry[]>([])
export const integrations = ref<Integration[]>([])
export const search = ref('')
export const loading = ref(false)
export const newIntegration = ref({
  type: '',
  name: '',
  config: {
    enableWebhooks: false
  } as any
})

// Computed properties for v-model bindings
export const selectedIntegrationRootFolder = computed({
  get: () => selectedIntegration.value?.rootFolder || '',
  set: (value) => {
    if (selectedIntegration.value) {
      selectedIntegration.value.rootFolder = value
    }
  }
})

export const selectedIntegrationEnableWebhooks = computed({
  get: () => selectedIntegration.value?.config?.enableWebhooks || false,
  set: (value) => {
    if (selectedIntegration.value) {
      if (!selectedIntegration.value.config) {
        selectedIntegration.value.config = {}
      }
      selectedIntegration.value.config.enableWebhooks = value
    }
  }
})

// Available integrations
export const availableIntegrations = ref<AvailableIntegration[]>([
  {
    id: 'dropbox',
    type: 'dropbox',
    name: 'Dropbox',
    description: 'Connect your Dropbox account to sync files',
    icon: 'mdi-dropbox',
    color: '#0061ff'
  },
  {
    id: 'googledrive',
    type: 'googledrive',
    name: 'Google Drive',
    description: 'Connect your Google Drive account to sync files',
    icon: 'mdi-google-drive',
    color: '#4285f4'
  },
  {
    id: 'onedrive',
    type: 'onedrive',
    name: 'OneDrive',
    description: 'Connect your OneDrive account to sync files',
    icon: 'mdi-microsoft-onedrive',
    color: '#0078d4'
  }
])

// Filtered integrations based on search
export const filteredIntegrations = computed(() => {
  if (!search.value) return integrations.value
  const term = search.value.toLowerCase()
  return integrations.value.filter(integration => 
    integration.name.toLowerCase().includes(term) || 
    (integration.description && integration.description.toLowerCase().includes(term)) ||
    integration.type.toLowerCase().includes(term)
  )
})

// Function to update integrations based on GraphQL query result
export function updateIntegrationsFromResult(result: any) {
  if (!result?.getSources) return
  integrations.value = result.getSources.map((s: any) => ({
    id: s.id,
    type: s.type === 'google_drive' ? 'googledrive' : s.type,
    name: s.name,
    description: s.type === 'dropbox' ? 'Dropbox storage' : s.type === 'google_drive' ? 'Google Drive storage' : s.type,
    connected: s.active,
    lastSync: s.updatedAt,
    rootFolder: s.config?.rootFolder,
    webhookStatus: s.config?.enableWebhooks ? 'active' : 'inactive',
    stats: undefined,
    __existing: true,
    active: s.active,
    updatedAt: s.updatedAt,
    config: s.config,
  }))
}
