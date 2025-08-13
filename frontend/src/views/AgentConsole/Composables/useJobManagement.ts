import { ref, computed, Ref } from 'vue'
import { Job, Log } from './Interface'

export function useJobManagement(
  jobs: Ref<Job[]>, 
  logs: Ref<Log[]>, 
  subscribeJobLogs: (jobId: string) => void, 
  cancel: (jobId: string) => void
) {
  
  // State
  const searchQuery = ref('')
  const statusFilter = ref<string | null>(null)
  const typeFilter = ref<string | null>(null)
  
  // Computed
  const filteredJobs = computed(() => {
    return jobs.value.filter((job) => {
      // Search filter
      if (searchQuery.value && 
          !job.id.toLowerCase().includes(searchQuery.value.toLowerCase()) &&
          !job.type.toLowerCase().includes(searchQuery.value.toLowerCase()) &&
          !job.status.toLowerCase().includes(searchQuery.value.toLowerCase())) {
        return false
      }
      
      // Status filter
      if (statusFilter.value && job.status !== statusFilter.value) {
        return false
      }
      
      // Type filter
      if (typeFilter.value && job.type !== typeFilter.value) {
        return false
      }
      
      return true
    })
  })
  
  const loading = ref(false)
  
  // Methods
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
  
  function openLogs(job: Job) {
    // This is a placeholder implementation
    // In a real implementation, you would open the logs dialog
    console.log('Opening logs for job', job.id)
  }
  
  // Utility functions
  function getJobStatusColor(status: string) {
    switch (status) {
      case 'completed': return 'success'
      case 'failed': return 'error'
      case 'active': return 'info'
      case 'waiting': return 'warning'
      case 'delayed': return 'purple'
      default: return 'grey'
    }
  }
  
  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
    return `${(ms / 60000).toFixed(2)}m`
  }
  
  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString()
  }
  
  // Return values
  return {
    // State
    searchQuery,
    statusFilter,
    typeFilter,
    
    // Computed
    filteredJobs,
    loading,
    jobs,
    logs,
    
    // Methods
    refetchJobs,
    cancelJob,
    openLogs,
    subscribeJobLogs,
    
    // Utility functions
    getJobStatusColor,
    formatDuration,
    formatDate,
  }
}
