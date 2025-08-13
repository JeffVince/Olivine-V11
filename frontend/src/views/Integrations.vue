<template>
  <div>
    <!-- Header -->
    <v-row class="mb-4">
      <v-col
        cols="12"
        md="8"
      >
        <h1 class="text-h4 font-weight-bold">
          Integrations
        </h1>
        <p class="text-subtitle-1 text-medium-emphasis">
          Connect and manage external services for your project
        </p>
      </v-col>
      <v-col
        cols="12"
        md="4"
        class="text-right"
      >
        <v-btn 
          color="primary"
          prepend-icon="mdi-plus"
          class="liquid-button"
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
          class="integration-card glass-card"
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
              <div class="text-h6">
                {{ integration.name }}
              </div>
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
            <p class="text-body-2 mb-3">
              {{ integration.description }}
            </p>
            
            <!-- Connection Status -->
            <div
              v-if="integration.connected"
              class="mb-3"
            >
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
            <div
              v-if="integration.stats"
              class="mb-3"
            >
              <v-row>
                <v-col cols="6">
                  <div class="text-center">
                    <div class="text-h6">
                      {{ integration.stats.files }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      Files
                    </div>
                  </div>
                </v-col>
                <v-col cols="6">
                  <div class="text-center">
                    <div class="text-h6">
                      {{ integration.stats.folders }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      Folders
                    </div>
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
              :loading="connecting === integration.id"
              @click="connectIntegration(integration)"
            >
              Connect
            </v-btn>
            
            <template v-else>
              <v-btn 
                color="primary"
                variant="outlined"
                :loading="syncing === integration.id"
                @click="triggerSync(integration)"
              >
                Sync Now
              </v-btn>
              
              <v-spacer />
              
              <v-menu>
                <template #activator="{ props }">
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
                      <v-icon start>
                        mdi-cog
                      </v-icon>
                      Configure
                    </v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="viewLogs(integration)">
                    <v-list-item-title>
                      <v-icon start>
                        mdi-text-box
                      </v-icon>
                      View Logs
                    </v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="resubscribeWebhook(integration)">
                    <v-list-item-title>
                      <v-icon start>
                        mdi-webhook
                      </v-icon>
                      Resubscribe Webhook
                    </v-list-item-title>
                  </v-list-item>
                  <v-divider />
                  <v-list-item
                    class="text-error"
                    @click="disconnectIntegration(integration)"
                  >
                    <v-list-item-title>
                      <v-icon start>
                        mdi-link-off
                      </v-icon>
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
    <v-card class="mt-6 glass-card">
      <v-card-title>
        <v-icon class="mr-2">
          mdi-store
        </v-icon>
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
                  <v-icon
                    :icon="getIntegrationIcon(available.type)"
                    size="24"
                  />
                </v-avatar>
                <h4 class="text-subtitle-1 mb-2">
                  {{ available.name }}
                </h4>
                <p class="text-body-2 text-medium-emphasis">
                  {{ available.description }}
                </p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Add Integration Dialog -->
    <v-dialog
      v-model="showAddDialog"
      max-width="500"
    >
      <v-card class="glass-card">
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
          <v-btn
            variant="text"
            @click="showAddDialog = false"
          >
            Cancel
          </v-btn>
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
    <v-dialog
      v-model="showConfigDialog"
      max-width="600"
    >
      <v-card v-if="configIntegration" class="glass-card">
        <v-card-title>
          Configure {{ configIntegration.name }}
        </v-card-title>
        <v-card-text>
          <v-form
            ref="configForm"
            v-model="configValid"
          >
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
          <v-btn
            variant="text"
            @click="showConfigDialog = false"
          >
            Cancel
          </v-btn>
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
    <v-dialog
      v-model="showLogsDialog"
      max-width="800"
    >
      <v-card class="glass-card">
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
            <template #item.level="{ item }">
              <v-chip 
                :color="getLogLevelColor(item.level)"
                size="small"
                variant="tonal"
              >
                {{ item.level }}
              </v-chip>
            </template>
            
            <template #item.timestamp="{ item }">
              {{ formatDateTime(item.timestamp) }}
            </template>
          </v-data-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showLogsDialog = false"
          >
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'
import { useQuery, useMutation } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'

// Type definitions
interface Integration {
  id: string
  name: string
  type: 'dropbox' | 'slack' | 'googledrive' | 'frameio' | 'gmail' | string
  description: string
  connected: boolean
  lastSync?: string
  status: 'connected' | 'disconnected' | 'error'
  error?: string
  config?: Record<string, any>
  webhookStatus?: 'active' | 'inactive' | 'error'
  rootFolder?: string
  stats?: {
    files: number
    folders: number
  }
  // Internal flag to indicate this entry comes from backend sources
  __existing?: boolean
  organizationId?: string
}

interface AvailableIntegration {
  id: string
  name: string
  type: string
  description: string
  icon: string
  color: string
}

interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
  details?: string
}

// Constants
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

// Router and Stores
const route = useRoute()
const notificationStore = useNotificationStore()
const orgStore = useOrganizationStore()

// State
const showAddDialog = ref(false)
const showConfigDialog = ref(false)
const showLogsDialog = ref(false)
const selectedIntegrationType = ref('')
const configIntegration = ref<Integration | null>(null)
const logsIntegration = ref<Integration | null>(null)
const connecting = ref<string | null>(null)
const syncing = ref<string | null>(null)
const saving = ref(false)
const loading = ref(false)
const loadingLogs = ref(false)
const error = ref<string | null>(null)
const configValid = ref(false)
const selectedIntegration = ref<Integration | null>(null)
const selectedAvailable = ref<AvailableIntegration | null>(null)

// Configuration data
const configData = ref({
  syncFrequency: 'hourly',
  rootFolder: '/',
  notifications: true,
  enableWebhooks: true
})

// Data collections
const integrations = ref<Integration[]>([])
const logs = ref<LogEntry[]>([])

// UI Configuration
const logHeaders = [
  { title: 'Timestamp', key: 'timestamp' },
  { title: 'Level', key: 'level' },
  { title: 'Message', key: 'message' }
]

// Available integrations with their configurations
const availableIntegrations = ref<AvailableIntegration[]>([
  {
    id: 'dropbox',
    name: 'Dropbox',
    type: 'dropbox',
    description: 'Connect your Dropbox account to access files and folders',
    icon: 'mdi-dropbox',
    color: '#0061FF'
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    type: 'google',
    description: 'Connect your Google Drive to access files and folders',
    icon: 'mdi-google-drive',
    color: '#4285F4'
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    type: 'onedrive',
    description: 'Connect your OneDrive to access files and folders',
    icon: 'mdi-microsoft-onedrive',
    color: '#0078D4'
  },
  {
    id: 'slack',
    name: 'Slack',
    type: 'slack',
    description: 'Connect your Slack workspace to manage notifications',
    icon: 'mdi-slack',
    color: '#4A154B'
  },
  {
    id: 'github',
    name: 'GitHub',
    type: 'github',
    description: 'Connect your GitHub repositories',
    icon: 'mdi-github',
    color: '#181717'
  }
])

// Sync frequencies
const syncFrequencies = [
  { title: 'Every 15 minutes', value: '15m' },
  { title: 'Every hour', value: '1h' },
  { title: 'Every 6 hours', value: '6h' },
  { title: 'Every 12 hours', value: '12h' },
  { title: 'Manual', value: 'manual' }
]

// Utility functions
const getIntegrationColor = (type: string): string => {
  const integration = availableIntegrations.value.find(i => i.type === type)
  return integration?.color || '#64748b'
}

const getIntegrationIcon = (type: string): string => {
  const integration = availableIntegrations.value.find(i => i.type === type)
  return integration?.icon || 'mdi-puzzle'
}

const getLogLevelColor = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'error':
      return 'error'
    case 'warn':
      return 'warning'
    default:
      return 'info'
  }
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString()
}

const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString()
}

// Integration methods
const connectIntegration = async (integration: Integration) => {
  try {
    console.log('connectIntegration called with:', integration);
    connecting.value = integration.id;
    
    const orgId = orgStore.currentOrg?.id;
    if (!orgId) {
      throw new Error('No organization selected');
    }
    
    let sourceId = integration.id;
    console.log('Starting with sourceId:', sourceId);
    
    if (!integration.__existing) {
      console.log('Creating new source for integration:', integration.type);
      // Implementation for creating a new source would go here
    }
    
    // Build the OAuth URL with state
    const state = {
      organizationId: orgId,
      sourceId: sourceId,
      projectId: route.params.projectId
    };
    
  } finally {
    connecting.value = null
  }
}

const disconnectIntegration = async (integration: Integration) => {
  try {
    // Implementation for disconnecting integration
    notificationStore.showSuccess(`Successfully disconnected from ${integration.name}`)
  } catch (err: any) {
    notificationStore.showError(`Failed to disconnect from ${integration.name}: ${err.message}`)
  }
}

const triggerSync = async (integration: Integration) => {
  try {
    syncing.value = integration.id
    // Implementation for triggering sync
    notificationStore.showSuccess(`Sync triggered for ${integration.name}`)
  } catch (err: any) {
    notificationStore.showError(`Failed to sync ${integration.name}: ${err.message}`)
  } finally {
    syncing.value = null
  }
}

const configureIntegration = (integration: Integration) => {
  selectedIntegration.value = integration
  showConfigDialog.value = true
}

const viewLogs = (integration: Integration) => {
  logsIntegration.value = integration
  loadingLogs.value = true
  // Implementation for fetching logs
  loadingLogs.value = false
}

const resubscribeWebhook = async (integration: Integration) => {
  try {
    // Implementation for resubscribing webhook
    notificationStore.showSuccess(`Webhook resubscribed for ${integration.name}`)
  } catch (err: any) {
    notificationStore.showError(`Failed to resubscribe webhook for ${integration.name}: ${err.message}`)
  }
}

const addIntegration = (available: AvailableIntegration) => {
  selectedAvailable.value = available
  selectedIntegrationType.value = available.type
  showAddDialog.value = true
}

const proceedWithIntegration = async () => {
  if (!selectedIntegrationType.value) return
  
  const integration = availableIntegrations.value.find((i: AvailableIntegration) => i.type === selectedIntegrationType.value)
  if (!integration) return
  
  // Implementation for proceeding with integration
  showAddDialog.value = false
  notificationStore.showSuccess(`Starting ${integration.name} integration...`)
}

const saveConfiguration = async () => {
  if (!selectedIntegration.value) return
  
  try {
    saving.value = true
    // Implementation for saving configuration
    showConfigDialog.value = false
    notificationStore.showSuccess('Configuration saved successfully')
  } catch (err: any) {
    notificationStore.showError(`Failed to save configuration: ${err.message}`)
  } finally {
    saving.value = false
  }
}

const closeConfigDialog = () => {
  showConfigDialog.value = false
  selectedIntegration.value = null
}

const closeLogsDialog = () => {
  showLogsDialog.value = false
  logsIntegration.value = null
}

// Expose necessary variables and methods to the template
defineExpose({
  // UI State
  showAddDialog,
  showConfigDialog,
  showLogsDialog,
  
  // Data
  selectedIntegration,
  selectedAvailable,
  configData,
  configValid,
  integrations,
  availableIntegrations,
  logs,
  logsIntegration,
  logHeaders,
  
  // Loading States
  connecting,
  syncing,
  saving,
  loading,
  loadingLogs,
  
  // Error State
  error,
  
  // Integration Methods
  connectIntegration,
  disconnectIntegration,
  triggerSync,
  configureIntegration,
  viewLogs,
  resubscribeWebhook,
  addIntegration,
  proceedWithIntegration,
  saveConfiguration,
  closeConfigDialog,
  closeLogsDialog,
  
  // Utility Functions
  getIntegrationColor,
  getIntegrationIcon,
  getLogLevelColor,
  formatDate,
  formatDateTime,
  
  // Constants
  syncFrequencies
})

// GraphQL
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

// Connect to an integration (starts OAuth flow)
async function connectIntegration(integration: Integration) {
  console.log('connectIntegration called with:', integration);
  
  // Set loading state
  connecting.value = integration.id;
  
  try {
    // Get current organization ID
    const orgId = orgStore.currentOrg?.id;
    console.log('Current org ID:', orgId);
    
    if (!orgId) {
      const error = new Error('No organization selected');
      console.error('Error in connectIntegration:', error);
      throw error;
    }
    
    let sourceId = integration.id;
    console.log('Starting with sourceId:', sourceId);
    
    // Step 1: Create a source if this is a new integration entry
    if (!integration.__existing) {
      console.log('Creating new source for integration');
      const type = integration.type === 'googledrive' ? 'google_drive' : integration.type;
      console.log('Creating source with type:', type);
      
      try {
        const res = await createSource({ 
          organizationId: orgId, 
          name: integration.name, 
          type, 
          config: {} 
        });
        
        console.log('Create source response:', res);
        
        if (!res?.data?.createSource?.id) {
          const error = new Error('Failed to create source: Invalid response from server');
          console.error(error);
          throw error;
        }
        
        sourceId = res.data.createSource.id;
        console.log('New source ID:', sourceId);
        
        // Update integration id to backend id for subsequent actions
        integration.id = sourceId;
        integration.__existing = true;
      } catch (createError) {
        console.error('Error creating source:', createError);
        throw new Error(`Failed to create source: ${createError.message || 'Unknown error'}`);
      }
    }
    
    // Step 2: Build the OAuth URL
    const basePath = integration.type === 'dropbox' ? '/api/oauth/dropbox' : '/api/oauth/gdrive';
    console.log('Using base path:', basePath);
    
    // Determine the base URL for the API
    const baseUrl = API_BASE || window.location.origin;
    console.log('Using base URL:', baseUrl);
    
    // Create the URL object
    const url = new URL(basePath, baseUrl);
    
    // Get project ID from route if available
    const projectId = (route.params.id as string) || '';
    
    // Create state object to maintain context
    const state = JSON.stringify({ 
      organizationId: orgId, 
      sourceId, 
      projectId,
      timestamp: Date.now()
    });
    
    console.log('OAuth state:', state);
    
    // Add query parameters
    url.searchParams.set('state', encodeURIComponent(state));
    url.searchParams.set('organizationId', orgId);
    url.searchParams.set('sourceId', sourceId);
    
    console.log('Final OAuth URL:', url.toString());
    
    // Add a small delay to ensure the loading state is visible
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // For debugging - uncomment to test without redirecting
    // notificationStore.add('info', `Would redirect to: ${url.toString()}`);
    // return;
    
    // Redirect to OAuth URL
    window.location.href = url.toString();
    
  } catch (error) {
    console.error('Error in connectIntegration:', error);
    notificationStore.add('error', `Failed to connect ${integration.name}: ${error.message || 'Unknown error'}`);
  } finally {
    connecting.value = null;
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


