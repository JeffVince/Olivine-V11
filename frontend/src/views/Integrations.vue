<template>
  <div>
    <!-- Header -->
    <v-row class="mb-4">
      <v-col cols="12" md="8">
        <h1 class="text-h4 font-weight-bold">Integrations</h1>
        <p class="text-subtitle-1 text-medium-emphasis">
          Connect and manage external services for your project
        </p>
      </v-col>
      <v-col cols="12" md="4" class="text-right">
        <v-btn 
          color="primary"
          prepend-icon="mdi-plus"
          @click="showAddDialog = true"
        >
          Add Integration
        </v-btn>
      </v-col>
    </v-row>

    <!-- Integration Cards -->
    <v-row>
      <v-col 
        v-for="integration in integrations"
        :key="integration.id"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card 
          class="integration-card"
          :class="{ 'connected': integration.connected }"
        >
          <v-card-title class="d-flex align-center">
            <v-avatar 
              :color="getIntegrationColor(integration.type)"
              class="mr-3"
              size="40"
            >
              <v-icon :icon="getIntegrationIcon(integration.type)" />
            </v-avatar>
            <div>
              <div class="text-h6">{{ integration.name }}</div>
              <v-chip 
                :color="integration.connected ? 'success' : 'warning'"
                size="small"
                variant="tonal"
              >
                {{ integration.connected ? 'Connected' : 'Disconnected' }}
              </v-chip>
            </div>
          </v-card-title>

          <v-card-text>
            <p class="text-body-2 mb-3">{{ integration.description }}</p>
            
            <!-- Connection Status -->
            <div v-if="integration.connected" class="mb-3">
              <v-list density="compact">
                <v-list-item v-if="integration.lastSync">
                  <v-list-item-title>Last Sync</v-list-item-title>
                  <v-list-item-subtitle>{{ formatDate(integration.lastSync) }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="integration.rootFolder">
                  <v-list-item-title>Root Folder</v-list-item-title>
                  <v-list-item-subtitle>{{ integration.rootFolder }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="integration.webhookStatus">
                  <v-list-item-title>Webhook Status</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip 
                      :color="integration.webhookStatus === 'active' ? 'success' : 'warning'"
                      size="x-small"
                    >
                      {{ integration.webhookStatus }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </div>

            <!-- Statistics -->
            <div v-if="integration.stats" class="mb-3">
              <v-row>
                <v-col cols="6">
                  <div class="text-center">
                    <div class="text-h6">{{ integration.stats.files }}</div>
                    <div class="text-caption text-medium-emphasis">Files</div>
                  </div>
                </v-col>
                <v-col cols="6">
                  <div class="text-center">
                    <div class="text-h6">{{ integration.stats.folders }}</div>
                    <div class="text-caption text-medium-emphasis">Folders</div>
                  </div>
                </v-col>
              </v-row>
            </div>
          </v-card-text>

          <v-card-actions>
            <v-btn 
              v-if="!integration.connected"
              color="primary"
              variant="flat"
              @click="connectIntegration(integration)"
              :loading="connecting === integration.id"
            >
              Connect
            </v-btn>
            
            <template v-else>
              <v-btn 
                color="primary"
                variant="outlined"
                @click="triggerSync(integration)"
                :loading="syncing === integration.id"
              >
                Sync Now
              </v-btn>
              
              <v-spacer />
              
              <v-menu>
                <template v-slot:activator="{ props }">
                  <v-btn 
                    v-bind="props"
                    icon="mdi-dots-vertical"
                    variant="text"
                    size="small"
                  />
                </template>
                <v-list>
                  <v-list-item @click="configureIntegration(integration)">
                    <v-list-item-title>
                      <v-icon start>mdi-cog</v-icon>
                      Configure
                    </v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="viewLogs(integration)">
                    <v-list-item-title>
                      <v-icon start>mdi-text-box</v-icon>
                      View Logs
                    </v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="resubscribeWebhook(integration)">
                    <v-list-item-title>
                      <v-icon start>mdi-webhook</v-icon>
                      Resubscribe Webhook
                    </v-list-item-title>
                  </v-list-item>
                  <v-divider />
                  <v-list-item @click="disconnectIntegration(integration)" class="text-error">
                    <v-list-item-title>
                      <v-icon start>mdi-link-off</v-icon>
                      Disconnect
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </template>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Available Integrations -->
    <v-card class="mt-6">
      <v-card-title>
        <v-icon class="mr-2">mdi-store</v-icon>
        Available Integrations
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col 
            v-for="available in availableIntegrations"
            :key="available.type"
            cols="12"
            sm="6"
            md="4"
          >
            <v-card 
              variant="outlined"
              class="available-integration"
              @click="addIntegration(available)"
            >
              <v-card-text class="text-center pa-4">
                <v-avatar 
                  :color="getIntegrationColor(available.type)"
                  size="48"
                  class="mb-3"
                >
                  <v-icon :icon="getIntegrationIcon(available.type)" size="24" />
                </v-avatar>
                <h4 class="text-subtitle-1 mb-2">{{ available.name }}</h4>
                <p class="text-body-2 text-medium-emphasis">{{ available.description }}</p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Add Integration Dialog -->
    <v-dialog v-model="showAddDialog" max-width="500">
      <v-card>
        <v-card-title>Add Integration</v-card-title>
        <v-card-text>
          <v-select
            v-model="selectedIntegrationType"
            :items="availableIntegrations"
            item-title="name"
            item-value="type"
            label="Select Integration Type"
            prepend-icon="mdi-puzzle"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showAddDialog = false">Cancel</v-btn>
          <v-btn 
            color="primary" 
            :disabled="!selectedIntegrationType"
            @click="proceedWithIntegration"
          >
            Continue
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Configuration Dialog -->
    <v-dialog v-model="showConfigDialog" max-width="600">
      <v-card v-if="configIntegration">
        <v-card-title>
          Configure {{ configIntegration.name }}
        </v-card-title>
        <v-card-text>
          <v-form ref="configForm" v-model="configValid">
            <v-text-field
              v-model="configData.rootFolder"
              label="Root Folder Path"
              prepend-icon="mdi-folder"
              hint="The folder path to monitor for changes"
              persistent-hint
            />
            
            <v-switch
              v-model="configData.enableWebhooks"
              label="Enable Real-time Webhooks"
              hint="Receive instant notifications for file changes"
              persistent-hint
              class="mt-4"
            />
            
            <v-select
              v-model="configData.syncFrequency"
              :items="syncFrequencies"
              label="Sync Frequency"
              prepend-icon="mdi-clock"
              hint="How often to check for changes if webhooks are disabled"
              persistent-hint
              class="mt-4"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showConfigDialog = false">Cancel</v-btn>
          <v-btn 
            color="primary" 
            :disabled="!configValid"
            :loading="saving"
            @click="saveConfiguration"
          >
            Save Configuration
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Logs Dialog -->
    <v-dialog v-model="showLogsDialog" max-width="800">
      <v-card>
        <v-card-title>
          Integration Logs - {{ logsIntegration?.name }}
        </v-card-title>
        <v-card-text>
          <v-data-table
            :items="logs"
            :headers="logHeaders"
            item-key="id"
            density="compact"
            :loading="loadingLogs"
          >
            <template v-slot:item.level="{ item }">
              <v-chip 
                :color="getLogLevelColor(item.level)"
                size="small"
                variant="tonal"
              >
                {{ item.level }}
              </v-chip>
            </template>
            
            <template v-slot:item.timestamp="{ item }">
              {{ formatDateTime(item.timestamp) }}
            </template>
          </v-data-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showLogsDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'
import { useQuery, useMutation } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || ''}`

interface Integration {
  id: string
  type: 'dropbox' | 'googledrive' | 'frameio' | 'slack' | 'gmail'
  name: string
  description: string
  connected: boolean
  lastSync?: string
  rootFolder?: string
  webhookStatus?: 'active' | 'inactive' | 'error'
  stats?: {
    files: number
    folders: number
  }
  // internal flag to indicate this entry comes from backend sources
  __existing?: boolean
}

interface AvailableIntegration {
  type: string
  name: string
  description: string
}

interface LogEntry {
  id: string
  level: 'info' | 'warning' | 'error'
  message: string
  timestamp: string
}

const route = useRoute()
const notificationStore = useNotificationStore()

// State
const integrations = ref<Integration[]>([])
const showAddDialog = ref(false)
const showConfigDialog = ref(false)
const showLogsDialog = ref(false)
const selectedIntegrationType = ref('')
const configIntegration = ref<Integration | null>(null)
const logsIntegration = ref<Integration | null>(null)
const connecting = ref<string | null>(null)
const syncing = ref<string | null>(null)
const saving = ref(false)
const loadingLogs = ref(false)
const configValid = ref(false)
const logs = ref<LogEntry[]>([])

// Configuration data
const configData = ref({
  rootFolder: '',
  enableWebhooks: true,
  syncFrequency: 'hourly'
})

// GraphQL
const orgStore = useOrganizationStore()
const GET_SOURCES = gql`
  query GetSources($organizationId: ID!) {
    getSources(organizationId: $organizationId) {
      id
      organizationId
      name
      type
      active
      updatedAt
      config
    }
  }
`

const CREATE_SOURCE = gql`
  mutation CreateSource($organizationId: ID!, $name: String!, $type: SourceType!, $config: JSON) {
    createSource(organizationId: $organizationId, name: $name, type: $type, config: $config) {
      id
      name
      type
      organizationId
      active
    }
  }
`

const TRIGGER_RESYNC = gql`
  mutation TriggerSourceResync($sourceId: ID!, $organizationId: ID!) {
    triggerSourceResync(sourceId: $sourceId, organizationId: $organizationId)
  }
`

const { result, loading, refetch } = useQuery(GET_SOURCES, () => ({ organizationId: orgStore.currentOrg?.id || '' }))
const { mutate: createSource } = useMutation(CREATE_SOURCE)
const { mutate: triggerResync } = useMutation(TRIGGER_RESYNC)

// Available integrations
const availableIntegrations: AvailableIntegration[] = [
  {
    type: 'dropbox',
    name: 'Dropbox',
    description: 'Connect to Dropbox for file storage and sync'
  },
  {
    type: 'googledrive',
    name: 'Google Drive',
    description: 'Connect to Google Drive for file storage and sync'
  },
  {
    type: 'frameio',
    name: 'Frame.io',
    description: 'Share artifacts and collaborate on Frame.io'
  },
  {
    type: 'slack',
    name: 'Slack',
    description: 'Send notifications and updates to Slack channels'
  },
  {
    type: 'gmail',
    name: 'Gmail',
    description: 'Send email notifications and distribute call sheets'
  }
]

const syncFrequencies = [
  { title: 'Every 15 minutes', value: '15min' },
  { title: 'Every 30 minutes', value: '30min' },
  { title: 'Hourly', value: 'hourly' },
  { title: 'Every 6 hours', value: '6hours' },
  { title: 'Daily', value: 'daily' }
]

const logHeaders = [
  { title: 'Level', key: 'level', sortable: true },
  { title: 'Message', key: 'message', sortable: false },
  { title: 'Timestamp', key: 'timestamp', sortable: true }
]

// Methods
function getIntegrationColor(type: string) {
  switch (type) {
    case 'dropbox': return 'blue'
    case 'googledrive': return 'green'
    case 'frameio': return 'purple'
    case 'slack': return 'deep-purple'
    case 'gmail': return 'red'
    default: return 'grey'
  }
}

function getIntegrationIcon(type: string) {
  switch (type) {
    case 'dropbox': return 'mdi-dropbox'
    case 'googledrive': return 'mdi-google-drive'
    case 'frameio': return 'mdi-play-box'
    case 'slack': return 'mdi-slack'
    case 'gmail': return 'mdi-gmail'
    default: return 'mdi-puzzle'
  }
}

function getLogLevelColor(level: string) {
  switch (level) {
    case 'info': return 'primary'
    case 'warning': return 'warning'
    case 'error': return 'error'
    default: return 'grey'
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString()
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

async function connectIntegration(integration: Integration) {
  connecting.value = integration.id
  try {
    const orgId = orgStore.currentOrg?.id
    if (!orgId) throw new Error('No organization selected')
    let sourceId = integration.id
    // Step 1: create a source if this is a new integration entry (not yet in backend)
    if (!integration.__existing) {
      const type = integration.type === 'googledrive' ? 'google_drive' : integration.type
      const res = await createSource({ organizationId: orgId, name: integration.name, type, config: {} })
      sourceId = res?.data?.createSource?.id
      if (!sourceId) throw new Error('Failed to create source')
      // Update integration id to backend id for subsequent actions
      integration.id = sourceId
      integration.__existing = true
    }
    // Step 2: redirect to provider OAuth
    const basePath = integration.type === 'dropbox' ? '/api/oauth/dropbox' : '/api/oauth/gdrive'
    const absolute = API_BASE ? new URL(basePath, API_BASE) : new URL(basePath, window.location.origin)
    const url = absolute
    url.searchParams.set('organizationId', orgId)
    url.searchParams.set('sourceId', sourceId)
    const projectId = (route.params.id as string) || ''
    url.searchParams.set('state', JSON.stringify({ organizationId: orgId, sourceId, projectId }))
    window.location.href = url.toString()
  } catch (error) {
    notificationStore.add('error', `Failed to connect ${integration.name}`)
  } finally {
    connecting.value = null
  }
}

async function disconnectIntegration(integration: Integration) {
  try {
    integration.connected = false
    integration.lastSync = undefined
    integration.webhookStatus = undefined
    integration.stats = undefined
    
    notificationStore.add('info', `${integration.name} disconnected`)
  } catch (error) {
    notificationStore.add('error', `Failed to disconnect ${integration.name}`)
  }
}

async function triggerSync(integration: Integration) {
  syncing.value = integration.id
  try {
    const orgId = orgStore.currentOrg?.id
    if (!orgId) throw new Error('No organization selected')
    await triggerResync({ sourceId: integration.id, organizationId: orgId })
    integration.lastSync = new Date().toISOString()
    notificationStore.add('success', `${integration.name} sync triggered`)
  } catch (error) {
    notificationStore.add('error', `Failed to sync ${integration.name}`)
  } finally {
    syncing.value = null
  }
}

function configureIntegration(integration: Integration) {
  configIntegration.value = integration
  configData.value = {
    rootFolder: integration.rootFolder || '',
    enableWebhooks: integration.webhookStatus === 'active',
    syncFrequency: 'hourly'
  }
  showConfigDialog.value = true
}

async function saveConfiguration() {
  if (!configIntegration.value) return
  
  saving.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    configIntegration.value.rootFolder = configData.value.rootFolder
    configIntegration.value.webhookStatus = configData.value.enableWebhooks ? 'active' : 'inactive'
    
    showConfigDialog.value = false
    notificationStore.add('success', 'Configuration saved successfully')
  } catch (error) {
    notificationStore.add('error', 'Failed to save configuration')
  } finally {
    saving.value = false
  }
}

function viewLogs(integration: Integration) {
  logsIntegration.value = integration
  loadingLogs.value = true
  
  // Mock log data
  logs.value = [
    {
      id: '1',
      level: 'info',
      message: 'Webhook subscription renewed',
      timestamp: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      level: 'info',
      message: 'Sync completed successfully - 12 files processed',
      timestamp: '2024-01-15T09:15:00Z'
    },
    {
      id: '3',
      level: 'warning',
      message: 'File naming convention violation detected',
      timestamp: '2024-01-15T08:45:00Z'
    }
  ]
  
  setTimeout(() => {
    loadingLogs.value = false
  }, 500)
  
  showLogsDialog.value = true
}

async function resubscribeWebhook(integration: Integration) {
  try {
    await new Promise(resolve => setTimeout(resolve, 1000))
    integration.webhookStatus = 'active'
    notificationStore.add('success', 'Webhook resubscribed successfully')
  } catch (error) {
    notificationStore.add('error', 'Failed to resubscribe webhook')
  }
}

function addIntegration(available: AvailableIntegration) {
  selectedIntegrationType.value = available.type
  showAddDialog.value = true
}

function proceedWithIntegration() {
  const available = availableIntegrations.find(a => a.type === selectedIntegrationType.value)
  if (!available) return
  
  const newIntegration: Integration = {
    id: Date.now().toString(),
    type: available.type as any,
    name: available.name,
    description: available.description,
    connected: false
  }
  
  integrations.value.push(newIntegration)
  showAddDialog.value = false
  
  // Automatically start connection process
  setTimeout(() => {
    connectIntegration(newIntegration)
  }, 500)
}

// Load integrations on mount
onMounted(() => {
  if (result.value) updateFromResult()
})

watch(result, () => updateFromResult())

function updateFromResult() {
  if (!result.value?.getSources) return
  integrations.value = result.value.getSources.map((s: any) => ({
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
  }))
}
</script>


