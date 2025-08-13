<template>
  <div>
    <!-- Header -->
    <v-row class="mb-4">
      <v-col
        cols="12"
        md="8"
      >
        <h1 class="text-h4 font-weight-bold">
          Agent Console
        </h1>
        <p class="text-subtitle-1 text-medium-emphasis">
          Manage and monitor AI agents and automation workflows
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
          @click="showCreateDialog = true"
        >
          Create Agent
        </v-btn>
      </v-col>
    </v-row>

    <!-- System Status -->
    <v-row class="mb-6">
      <v-col
        cols="12"
        md="3"
      >
        <v-card class="glass-card">
          <v-card-text class="text-center">
            <v-icon
              size="48"
              color="success"
              class="mb-2"
            >
              mdi-robot
            </v-icon>
            <div class="text-h4">
              {{ activeAgents }}
            </div>
            <div class="text-subtitle-2 text-medium-emphasis">
              Active Agents
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="12"
        md="3"
      >
        <v-card class="glass-card">
          <v-card-text class="text-center">
            <v-icon
              size="48"
              color="primary"
              class="mb-2"
            >
              mdi-play
            </v-icon>
            <div class="text-h4">
              {{ totalActive }}
            </div>
            <div class="text-subtitle-2 text-medium-emphasis">
              Running Tasks
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="12"
        md="3"
      >
        <v-card>
          <v-card-text class="text-center">
            <v-icon
              size="48"
              color="warning"
              class="mb-2"
            >
              mdi-clock
            </v-icon>
            <div class="text-h4">
              {{ totalWaiting }}
            </div>
            <div class="text-subtitle-2 text-medium-emphasis">
              Queued Tasks
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="12"
        md="3"
      >
        <v-card>
          <v-card-text class="text-center">
            <v-icon
              size="48"
              color="error"
              class="mb-2"
            >
              mdi-alert
            </v-icon>
            <div class="text-h4">
              {{ totalFailed }}
            </div>
            <div class="text-subtitle-2 text-medium-emphasis">
              Failed Tasks
            </div>
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
              <v-icon class="mr-2">
                mdi-robot
              </v-icon>
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
                <AgentCard 
                  :agent="agent"
                  :toggling="toggling"
                  @view="viewAgent"
                  @edit="editAgent"
                  @duplicate="duplicateAgent"
                  @delete="deleteAgent"
                  @toggle="toggleAgentStatus"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Job Queue -->
    <v-row class="mt-4">
      <v-col cols="12">
        <JobsTable
          :jobs="filteredJobs"
          :loading="loading"
          @refresh="refetchJobs"
          @open-logs="openLogs"
          @cancel-job="cancelJob"
        />
      </v-col>
    </v-row>

    <!-- Logs Dialog -->
    <LogsDialog
      v-model="showLogDialog"
      :logs="selectedLogs"
    />

    <!-- Create Agent Dialog -->
    <CreateAgentDialog
      v-model="showCreateDialog"
      :agent="editingAgent"
      :saving="saving"
      @save="saveAgent"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useNotificationStore } from '@/stores/notificationStore'
import { useAgentJobs } from '@/composables/useAgentJobs'
import { useAgentHealth } from '@/composables/useAgentHealth'
import { useAgentManagement } from './Composables/useAgentManagement'
import { useJobManagement } from './Composables/useJobManagement'
import AgentCard from './Components/AgentCard.vue'
import JobsTable from './Components/JobsTable.vue'
import LogsDialog from './Components/LogsDialog.vue'
import CreateAgentDialog from './Components/CreateAgentDialog.vue'
import { Agent, Log, Job } from './Composables/Interface'

const notificationStore = useNotificationStore()
const { jobs, logs, subscribeJobLogs, cancel } = useAgentJobs()
const { healthData } = useAgentHealth()
const {
  agents,
  showCreateDialog,
  editingAgent,
  saving,
  search: agentSearch,
  statusFilter: agentStatusFilter,
  typeFilter: agentTypeFilter,
  filteredAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  toggleAgentStatus,
  duplicateAgent,
  viewAgent,
  editAgent,
  openCreateDialog,
  getAgentColor,
  getAgentIcon,
  getStatusColor,
  formatDateTime
} = useAgentManagement(notificationStore.addNotification)

const {
  searchQuery: jobSearchQuery,
  statusFilter: jobStatusFilter,
  typeFilter: jobTypeFilter,
  filteredJobs,
  loading: jobLoading,
  refetchJobs,
  cancelJob,
  openLogs,
  getJobStatusColor,
  formatDuration,
  formatDate
} = useJobManagement(jobs, logs, subscribeJobLogs, cancel)

// Logs dialog state
const showLogDialog = ref(false)
const toggling = ref<string | null>(null)
const searchQuery = ref('')
const statusFilter = ref('')

// Computed
const activeAgents = computed(() => agents.value.filter(a => a.status === 'active').length)
const runningTasks = computed(() => agents.value.reduce((sum, a) => sum + a.tasksRunning, 0))
const completedTasks = computed(() => agents.value.reduce((sum, a) => sum + a.tasksCompleted, 0))
const failedTasks = computed(() => agents.value.reduce((sum, a) => sum + a.tasksFailed, 0))

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

// Wire backend
const organizationStore = useOrganizationStore()
const orgIdRef = computed(() => organizationStore.currentOrg?.id || '')
const { status: healthStatus, queues } = useAgentHealth(orgIdRef)

// Job filters bind to query variables
const jobStatusFilter = ref<string | null>(null)
const jobTypeFilter = ref<string | null>(null)
watchEffect(() => {
  jobStatusFilter.value = jobStatusFilter.value || null
  jobTypeFilter.value = jobTypeFilter.value || null
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
const selectedLogs = computed(() => (selectedJobId.value ? (logs.value[selectedJobId.value] || []) as Log[] : []))

const filteredJobs = computed(() => {
  // This is a placeholder implementation
  // In a real implementation, you would filter the jobs based on search criteria
  return jobs.value
})

const loading = ref(false)

function refetchJobs() {
  // This is a placeholder implementation
  // In a real implementation, you would refetch the jobs
  console.log('Refetching jobs')
}

function cancelJob(job: Job) {
  // This is a placeholder implementation
  // In a real implementation, you would cancel the job
  console.log('Canceling job', job.id)
}

function saveAgent(agent: Agent) {
  // This is a placeholder implementation
  // In a real implementation, you would save the agent
  console.log('Saving agent', agent)
  showCreateDialog.value = false
}

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


</script>

<style scoped>
.agent-card {
  transition: all 0.3s ease;
}

.agent-card.active {
  border-left: 4px solid rgb(var(--v-theme-success));
}
</style>
