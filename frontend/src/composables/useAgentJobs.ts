import { ref, watchEffect } from 'vue'
import { useQuery, useMutation, useSubscription } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'

interface Job {
  id: string
  orgId: string
  type: string
  target: string
  status: string
  priority: number
  attemptsMade: number
  retries: number
  worker: string
  startedAt: string
  finishedAt: string
  durationMs: number
  params: Record<string, unknown>
}

const LIST_JOBS = gql`
  query AgentJobs($orgId: ID!, $status: JobStatus, $type: JobType, $limit: Int, $offset: Int) {
    agentJobs(orgId: $orgId, status: $status, type: $type, limit: $limit, offset: $offset) {
      id
      orgId
      type
      target
      status
      priority
      attemptsMade
      retries
      worker
      startedAt
      finishedAt
      durationMs
      params
    }
  }
`

const ENQUEUE_JOB = gql`
  mutation EnqueueAgentJob($input: EnqueueAgentJobInput!) {
    enqueueAgentJob(input: $input) {
      id
      type
      status
    }
  }
`

const CANCEL_JOB = gql`
  mutation CancelAgentJob($orgId: ID!, $id: ID!) {
    cancelAgentJob(orgId: $orgId, id: $id)
  }
`

const JOB_UPDATED = gql`
  subscription JobUpdated($orgId: ID!) {
    jobUpdated(orgId: $orgId) {
      id
      orgId
      type
      target
      status
      priority
      attemptsMade
      retries
      worker
      startedAt
      finishedAt
      durationMs
      params
    }
  }
`

const JOB_LOG_APPENDED = gql`
  subscription JobLogAppended($jobId: ID!) {
    jobLogAppended(jobId: $jobId) {
      jobId
      timestamp
      level
      message
    }
  }
`

export function useAgentJobs() {
  const organizationStore = useOrganizationStore()
  const jobs = ref<Job[]>([])
  const logs = ref<Record<string, unknown[]>>({})
  const variables = ref<{ orgId: string; status?: string | null; type?: string | null; limit?: number; offset?: number }>({
    orgId: organizationStore.currentOrg?.id || '',
    limit: 50,
    offset: 0,
  })

  const { onResult, refetch } = useQuery(LIST_JOBS, variables)
  onResult((r: { data?: { agentJobs: Job[] } }) => {
    if (r.data?.agentJobs) jobs.value = r.data.agentJobs
  })

  watchEffect(() => {
    variables.value.orgId = organizationStore.currentOrg?.id || ''
  })

  // Live updates for job status
  const { onResult: onJobUpdated } = useSubscription(JOB_UPDATED, () => ({ orgId: variables.value.orgId }))
  onJobUpdated((r: { data?: { jobUpdated: Job } }) => {
    const updated = r.data?.jobUpdated
    if (updated) {
      const idx = jobs.value.findIndex((j) => j.id === updated.id)
      if (idx >= 0) {
        jobs.value.splice(idx, 1, updated)
      } else {
        jobs.value.unshift(updated)
      }
    }
  })

  const { mutate: enqueue } = useMutation(ENQUEUE_JOB)
  const { mutate: cancel } = useMutation(CANCEL_JOB)

  function enqueueJob(input: { orgId: string; type: string; target?: string; priority?: number; params?: Record<string, unknown> }) {
    return enqueue({ input })
  }

  function cancelJob(orgId: string, id: string) {
    return cancel({ orgId, id })
  }

  function subscribeJobLogs(jobId: string) {
    const { onResult: onLog } = useSubscription(JOB_LOG_APPENDED, { jobId })
    onLog((r) => {
      const entry = r.data?.jobLogAppended
      if (!entry) return
      logs.value[jobId] = logs.value[jobId] || []
      logs.value[jobId].push(entry)
    })
  }

  return { jobs, logs, variables, refetch, enqueueJob, cancelJob, subscribeJobLogs }
}


