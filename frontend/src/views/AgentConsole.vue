<template>
  <div>
    <!-- Header -->
    <v-row class="mb-4">
      <v-col cols="12" md="8">
        <h1 class="text-h4 font-weight-bold">Agent Console</h1>
        <p class="text-subtitle-1 text-medium-emphasis">
          Manage and monitor AI agents and automation workflows
        </p>
      </v-col>
      <v-col cols="12" md="4" class="text-right">
        <v-btn 
          color="primary"
          prepend-icon="mdi-plus"
          @click="showCreateDialog = true"
        >
          Create Agent
        </v-btn>
      </v-col>
    </v-row>

    <!-- System Status -->
    <v-row class="mb-6">
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <v-icon size="48" color="success" class="mb-2">mdi-robot</v-icon>
            <div class="text-h4">{{ activeAgents }}</div>
            <div class="text-subtitle-2 text-medium-emphasis">Active Agents</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <v-icon size="48" color="primary" class="mb-2">mdi-play</v-icon>
            <div class="text-h4">{{ totalActive }}</div>
            <div class="text-subtitle-2 text-medium-emphasis">Running Tasks</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <v-icon size="48" color="warning" class="mb-2">mdi-clock</v-icon>
            <div class="text-h4">{{ totalWaiting }}</div>
            <div class="text-subtitle-2 text-medium-emphasis">Queued Tasks</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <v-icon size="48" color="error" class="mb-2">mdi-alert</v-icon>
            <div class="text-h4">{{ totalFailed }}</div>
            <div class="text-subtitle-2 text-medium-emphasis">Failed Tasks</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Agents List -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="d-flex align-center justify-space-between">
            <div>
              <v-icon class="mr-2">mdi-robot</v-icon>
              AI Agents
            </div>
            <div class="d-flex align-center gap-2">
              <v-text-field
                v-model="searchQuery"
                prepend-inner-icon="mdi-magnify"
                label="Search agents..."
                variant="outlined"
                density="compact"
                hide-details
                clearable
                style="width: 250px;"
              />
              <v-select
                v-model="statusFilter"
                :items="statusOptions"
                label="Filter by status"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                style="width: 150px;"
              />
            </div>
          </v-card-title>

          <v-card-text>
            <v-row>
              <v-col 
                v-for="agent in filteredAgents"
                :key="agent.id"
                cols="12"
                md="6"
                lg="4"
              >
                <v-card 
                  class="agent-card"
                  :class="{ 'active': agent.status === 'active' }"
                  variant="outlined"
                >
                  <v-card-title class="d-flex align-center">
                    <v-avatar 
                      :color="getAgentColor(agent.type)"
                      class="mr-3"
                      size="40"
                    >
                      <v-icon :icon="getAgentIcon(agent.type)" />
                    </v-avatar>
                    <div class="flex-grow-1">
                      <div class="text-subtitle-1">{{ agent.name }}</div>
                      <v-chip 
                        :color="getStatusColor(agent.status)"
                        size="x-small"
                        variant="tonal"
                      >
                        {{ agent.status }}
                      </v-chip>
                    </div>
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
                        <v-list-item @click="viewAgent(agent)">
                          <v-list-item-title>
                            <v-icon start>mdi-eye</v-icon>
                            View Details
                          </v-list-item-title>
                        </v-list-item>
                        <v-list-item @click="editAgent(agent)">
                          <v-list-item-title>
                            <v-icon start>mdi-pencil</v-icon>
                            Edit
                          </v-list-item-title>
                        </v-list-item>
                        <v-list-item @click="duplicateAgent(agent)">
                          <v-list-item-title>
                            <v-icon start>mdi-content-copy</v-icon>
                            Duplicate
                          </v-list-item-title>
                        </v-list-item>
                        <v-divider />
                        <v-list-item @click="deleteAgent(agent)" class="text-error">
                          <v-list-item-title>
                            <v-icon start>mdi-delete</v-icon>
                            Delete
                          </v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </v-menu>
                  </v-card-title>

                  <v-card-text>
                    <p class="text-body-2 mb-3">{{ agent.description }}</p>
                    
                    <!-- Agent Stats -->
                    <v-row class="text-center mb-3">
                      <v-col cols="4">
                        <div class="text-h6">{{ agent.tasksCompleted }}</div>
                        <div class="text-caption text-medium-emphasis">Completed</div>
                      </v-col>
                      <v-col cols="4">
                        <div class="text-h6">{{ agent.tasksRunning }}</div>
                        <div class="text-caption text-medium-emphasis">Running</div>
                      </v-col>
                      <v-col cols="4">
                        <div class="text-h6">{{ agent.uptime }}</div>
                        <div class="text-caption text-medium-emphasis">Uptime</div>
                      </v-col>
                    </v-row>

                    <!-- Last Activity -->
                    <div v-if="agent.lastActivity" class="text-caption text-medium-emphasis">
                      Last activity: {{ formatDateTime(agent.lastActivity) }}
                    </div>
                  </v-card-text>

                  <v-card-actions>
                    <v-btn 
                      :color="agent.status === 'active' ? 'warning' : 'success'"
                      variant="outlined"
                      size="small"
                      @click="toggleAgentStatus(agent)"
                      :loading="toggling === agent.id"
                    >
                      {{ agent.status === 'active' ? 'Stop' : 'Start' }}
                    </v-btn>
                    <v-spacer />
                    <v-btn 
                      color="primary"
                      variant="flat"
                      size="small"
                      @click="viewAgent(agent)"
                    >
                      View Details
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Jobs Table -->
    <v-row class="mt-6">
      <v-col cols="12">
        <v-card>
          <v-card-title class="d-flex align-center justify-space-between">
            <div>
              <v-icon class="mr-2">mdi-format-list-bulleted</v-icon>
              Jobs
            </div>
            <div class="d-flex align-center gap-2">
              <v-select
                v-model="jobStatusFilter"
                :items="jobStatusOptions"
                label="Status"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                style="width: 160px;"
              />
              <v-select
                v-model="jobTypeFilter"
                :items="jobTypeOptions"
                label="Type"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                style="width: 200px;"
              />
            </div>
          </v-card-title>
          <v-card-text>
            <v-data-table :headers="jobHeaders" :items="jobs" item-key="id" density="comfortable">
              <template #item.actions="{ item }">
                <v-btn size="x-small" color="primary" variant="tonal" @click="openLogs(item)">
                  Logs
                </v-btn>
                <v-btn size="x-small" color="error" variant="text" class="ml-2" @click="onCancelJob(item)">
                  Cancel
                </v-btn>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Logs Dialog -->
    <v-dialog v-model="showLogDialog" max-width="900">
      <v-card>
        <v-card-title>Job Logs</v-card-title>
        <v-card-text style="max-height: 60vh; overflow: auto;">
          <v-list v-if="selectedLogs.length">
            <v-list-item v-for="log in selectedLogs" :key="log.timestamp + log.message">
              <v-list-item-title>
                <strong>{{ new Date(log.timestamp).toLocaleString() }}</strong>
                <v-chip :color="log.level === 'error' ? 'error' : log.level === 'warn' ? 'warning' : 'info'" size="x-small" class="ml-2" variant="tonal">
                  {{ log.level }}
                </v-chip>
              </v-list-item-title>
              <v-list-item-subtitle class="mt-1">{{ log.message }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
          <div v-else class="text-medium-emphasis">No logs yet.</div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showLogDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Create Agent Dialog -->
    <v-dialog v-model="showCreateDialog" max-width="600">
      <v-card>
        <v-card-title>Create New Agent</v-card-title>
        <v-card-text>
          <v-form ref="createForm" v-model="createValid">
            <v-text-field
              v-model="newAgent.name"
              label="Agent Name"
              prepend-icon="mdi-robot"
              :rules="[v => !!v || 'Name is required']"
              required
            />
            
            <v-textarea
              v-model="newAgent.description"
              label="Description"
              prepend-icon="mdi-text"
              rows="3"
            />
            
            <v-select
              v-model="newAgent.type"
              :items="agentTypes"
              label="Agent Type"
              prepend-icon="mdi-format-list-bulleted-type"
              :rules="[v => !!v || 'Type is required']"
              required
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showCreateDialog = false">Cancel</v-btn>
          <v-btn 
            color="primary" 
            :disabled="!createValid"
            :loading="creating"
            @click="createAgent"
          >
            Create Agent
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watchEffect } from 'vue'
import { useNotificationStore } from '@/stores/notificationStore'
import { useAgentJobs } from '@/composables/useAgentJobs'
import { useAgentHealth } from '@/composables/useAgentHealth'
import { useOrganizationStore } from '@/stores/organizationStore'

interface Agent {
  id: string
  name: string
  description: string
  type: string
  status: 'active' | 'inactive' | 'error' | 'paused'
  tasksCompleted: number
  tasksRunning: number
  uptime: string
  lastActivity?: string
  created: string
}

const notificationStore = useNotificationStore()

// State
const showCreateDialog = ref(false)
const createValid = ref(false)
const creating = ref(false)
const toggling = ref<string | null>(null)
const searchQuery = ref('')
const statusFilter = ref('')

// Data
const agents = ref<Agent[]>([])

const newAgent = ref({
  name: '',
  description: '',
  type: ''
})

// Computed
const activeAgents = computed(() => agents.value.filter(a => a.status === 'active').length)
const runningTasks = computed(() => agents.value.reduce((sum, a) => sum + a.tasksRunning, 0))

const filteredAgents = computed(() => {
  let filtered = agents.value
  
  if (searchQuery.value) {
    filtered = filtered.filter(agent => 
      agent.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }
  
  if (statusFilter.value) {
    filtered = filtered.filter(agent => agent.status === statusFilter.value)
  }
  
  return filtered
})

// Options
const statusOptions = [
  { title: 'Active', value: 'active' },
  { title: 'Inactive', value: 'inactive' },
  { title: 'Error', value: 'error' },
  { title: 'Paused', value: 'paused' }
]

const agentTypes = [
  { title: 'File Processor', value: 'file-processor' },
  { title: 'Data Sync', value: 'data-sync' },
  { title: 'Notification', value: 'notification' },
  { title: 'Backup', value: 'backup' },
  { title: 'Analytics', value: 'analytics' },
  { title: 'Custom', value: 'custom' }
]

// Methods
function getAgentColor(type: string) {
  switch (type) {
    case 'file-processor': return 'blue'
    case 'data-sync': return 'green'
    case 'notification': return 'orange'
    case 'backup': return 'purple'
    case 'analytics': return 'teal'
    default: return 'grey'
  }
}

function getAgentIcon(type: string) {
  switch (type) {
    case 'file-processor': return 'mdi-file-cog'
    case 'data-sync': return 'mdi-sync'
    case 'notification': return 'mdi-bell'
    case 'backup': return 'mdi-backup-restore'
    case 'analytics': return 'mdi-chart-line'
    default: return 'mdi-robot'
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active': return 'success'
    case 'inactive': return 'grey'
    case 'error': return 'error'
    case 'paused': return 'warning'
    default: return 'grey'
  }
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

async function createAgent() {
  creating.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const agent: Agent = {
      id: Date.now().toString(),
      name: newAgent.value.name,
      description: newAgent.value.description,
      type: newAgent.value.type,
      status: 'inactive',
      tasksCompleted: 0,
      tasksRunning: 0,
      uptime: '0h',
      created: new Date().toISOString()
    }
    
    agents.value.push(agent)
    showCreateDialog.value = false
    
    newAgent.value = { name: '', description: '', type: '' }
    notificationStore.add('success', 'Agent created successfully')
  } catch (error) {
    notificationStore.add('error', 'Failed to create agent')
  } finally {
    creating.value = false
  }
}

function viewAgent(agent: Agent) {
  notificationStore.add('info', `Viewing details for ${agent.name}`)
}

function editAgent(agent: Agent) {
  notificationStore.add('info', `Editing ${agent.name}`)
}

function duplicateAgent(agent: Agent) {
  const duplicate: Agent = {
    ...agent,
    id: Date.now().toString(),
    name: `${agent.name} (Copy)`,
    status: 'inactive',
    tasksCompleted: 0,
    tasksRunning: 0,
    uptime: '0h',
    created: new Date().toISOString()
  }
  agents.value.push(duplicate)
  notificationStore.add('success', 'Agent duplicated successfully')
}

async function toggleAgentStatus(agent: Agent) {
  toggling.value = agent.id
  try {
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    if (agent.status === 'active') {
      agent.status = 'inactive'
      agent.tasksRunning = 0
      notificationStore.add('info', `${agent.name} stopped`)
    } else {
      agent.status = 'active'
      agent.lastActivity = new Date().toISOString()
      notificationStore.add('success', `${agent.name} started`)
    }
  } catch (error) {
    notificationStore.add('error', `Failed to toggle ${agent.name}`)
  } finally {
    toggling.value = null
  }
}

function deleteAgent(agent: Agent) {
  const index = agents.value.findIndex(a => a.id === agent.id)
  if (index > -1) {
    agents.value.splice(index, 1)
    notificationStore.add('info', `${agent.name} deleted`)
  }
}

// Wire backend
const organizationStore = useOrganizationStore()
const orgIdRef = computed(() => organizationStore.currentOrg?.id || '')
const { jobs, logs, variables, enqueueJob, cancelJob, subscribeJobLogs } = useAgentJobs()
const { status: healthStatus, queues } = useAgentHealth(orgIdRef)

// Job filters bind to query variables
const jobStatusFilter = ref<string | null>(null)
const jobTypeFilter = ref<string | null>(null)
watchEffect(() => {
  variables.value.status = jobStatusFilter.value || null
  variables.value.type = jobTypeFilter.value || null
})

// Queue statistics
const totalActive = computed(() => queues.value.reduce((s: number, q: any) => s + (q.active || 0), 0))
const totalWaiting = computed(() => queues.value.reduce((s: number, q: any) => s + (q.waiting || 0), 0))
const totalFailed = computed(() => queues.value.reduce((s: number, q: any) => s + (q.failed || 0), 0))

const jobStatusOptions = [
  { title: 'queued', value: 'queued' },
  { title: 'active', value: 'active' },
  { title: 'completed', value: 'completed' },
  { title: 'failed', value: 'failed' },
  { title: 'delayed', value: 'delayed' },
]

const jobTypeOptions = [
  { title: 'reindexProject', value: 'reindexProject' },
  { title: 'reclassifyLowConfidence', value: 'reclassifyLowConfidence' },
  { title: 'generateCallSheet', value: 'generateCallSheet' },
  { title: 'extractContent', value: 'extractContent' },
  { title: 'custom', value: 'custom' },
]

const jobHeaders = [
  { title: 'ID', key: 'id' },
  { title: 'Type', key: 'type' },
  { title: 'Target', key: 'target' },
  { title: 'Status', key: 'status' },
  { title: 'Started', key: 'startedAt' },
  { title: 'Duration (ms)', key: 'durationMs' },
  { title: 'Actions', key: 'actions', sortable: false },
]

// Logs dialog state
const showLogDialog = ref(false)
const selectedJobId = ref<string | null>(null)
const subscribed = ref<Set<string>>(new Set())
const selectedLogs = computed(() => (selectedJobId.value ? (logs.value[selectedJobId.value] || []) : []))

function openLogs(job: any) {
  if (!subscribed.value.has(job.id)) {
    subscribeJobLogs(job.id)
    subscribed.value.add(job.id)
  }
  selectedJobId.value = job.id
  showLogDialog.value = true
}

async function onCancelJob(item: any) {
  if (!orgIdRef.value) return
  await cancelJob(orgIdRef.value, item.id)
}

// Remove duplicate computed declarations (kept earlier ones)
</script>

<style scoped>
.agent-card {
  transition: all 0.3s ease;
}

.agent-card.active {
  border-left: 4px solid rgb(var(--v-theme-success));
}
</style>
