<template>
  <v-card>
    <v-card-title>
      <div class="d-flex align-center">
        <span>Job Queue</span>
        <v-spacer />
        <v-text-field
          v-model="search"
          label="Search jobs"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          class="max-w-200"
        />
      </div>
    </v-card-title>

    <v-card-text>
      <v-row class="mb-4">
        <v-col
          cols="12"
          md="4"
        >
          <v-select
            v-model="jobFilters.status"
            :items="[
              { title: 'All Statuses', value: null },
              { title: 'Queued', value: 'queued' },
              { title: 'Active', value: 'active' },
              { title: 'Completed', value: 'completed' },
              { title: 'Failed', value: 'failed' },
            ]"
            label="Status"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-col>
        <v-col
          cols="12"
          md="4"
        >
          <v-select
            v-model="jobFilters.type"
            :items="[
              { title: 'All Types', value: null },
              { title: 'File Processing', value: 'file-processing' },
              { title: 'Data Sync', value: 'data-sync' },
              { title: 'Notification', value: 'notification' },
              { title: 'Backup', value: 'backup' },
            ]"
            label="Type"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-col>
        <v-col
          cols="12"
          md="4"
        >
          <v-btn
            color="primary"
            variant="outlined"
            block
            @click="refreshJobs"
          >
            <v-icon start>
              mdi-refresh
            </v-icon>
            Refresh
          </v-btn>
        </v-col>
      </v-row>

      <v-data-table
        :headers="headers"
        :items="filteredJobs"
        :loading="loading"
        :items-per-page="10"
        item-value="id"
        class="elevation-1"
      >
        <template #item.status="{ item }">
          <v-chip
            :color="getJobStatusColor(item.status)"
            size="small"
            variant="tonal"
          >
            {{ item.status }}
          </v-chip>
        </template>
        <template #item.startedAt="{ item }">
          {{ formatDateTime(item.startedAt) }}
        </template>
        <template #item.durationMs="{ item }">
          {{ formatDuration(item.durationMs) }}
        </template>
        <template #item.actions="{ item }">
          <v-btn
            color="primary"
            variant="text"
            size="small"
            @click="openLogs(item)"
          >
            <v-icon start>
              mdi-file-document
            </v-icon>
            Logs
          </v-btn>
          <v-btn
            v-if="item.status === 'active' || item.status === 'queued'"
            color="warning"
            variant="text"
            size="small"
            @click="cancelJob(item)"
          >
            <v-icon start>
              mdi-cancel
            </v-icon>
            Cancel
          </v-btn>
        </template>
      </v-data-table>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Job } from '../Composables/Interface'

interface Props {
  jobs: Job[]
  loading: boolean
}

interface Emits {
  (e: 'refresh'): void
  (e: 'open-logs', job: Job): void
  (e: 'cancel-job', job: Job): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const search = ref('')
const jobFilters = ref({
  status: null as string | null,
  type: null as string | null,
})

const headers = [
  { title: 'Type', key: 'type' },
  { title: 'Target', key: 'target' },
  { title: 'Status', key: 'status' },
  { title: 'Started', key: 'startedAt' },
  { title: 'Duration', key: 'durationMs' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const filteredJobs = computed(() => {
  return props.jobs.filter((job) => {
    // Search filter
    if (search.value && !job.target.toLowerCase().includes(search.value.toLowerCase())) {
      return false
    }
    
    // Status filter
    if (jobFilters.value.status && job.status !== jobFilters.value.status) {
      return false
    }
    
    // Type filter
    if (jobFilters.value.type && job.type !== jobFilters.value.type) {
      return false
    }
    
    return true
  })
})

function getJobStatusColor(status: string) {
  switch (status) {
    case 'queued': return 'info'
    case 'active': return 'primary'
    case 'completed': return 'success'
    case 'failed': return 'error'
    default: return 'grey'
  }
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function refreshJobs() {
  emit('refresh')
}

function openLogs(job: Job) {
  emit('open-logs', job)
}

function cancelJob(job: Job) {
  emit('cancel-job', job)
}
</script>

<style scoped>
.max-w-200 {
  max-width: 200px;
}
</style>
