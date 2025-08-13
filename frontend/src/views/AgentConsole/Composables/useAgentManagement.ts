import { ref, computed } from 'vue'
import { Agent } from './Interface'

export function useAgentManagement(addNotification: (notification: { message: string; type: string }) => void) {
  
  // State
  const agents = ref<Agent[]>([
    {
      id: '1',
      name: 'File Processor',
      description: 'Processes uploaded files and extracts metadata',
      type: 'file-processor',
      status: 'active',
      tasksCompleted: 124,
      tasksRunning: 3,
      uptime: '2d 4h',
      lastActivity: '2023-05-15T14:30:00Z',
      created: '2023-05-10T09:15:00Z',
    },
    {
      id: '2',
      name: 'Data Sync',
      description: 'Synchronizes data with external systems',
      type: 'data-sync',
      status: 'active',
      tasksCompleted: 87,
      tasksRunning: 1,
      uptime: '1d 12h',
      lastActivity: '2023-05-15T14:25:00Z',
      created: '2023-05-12T11:30:00Z',
    },
    {
      id: '3',
      name: 'Notification Service',
      description: 'Sends notifications to users',
      type: 'notification',
      status: 'inactive',
      tasksCompleted: 203,
      tasksRunning: 0,
      uptime: '0h 0m',
      created: '2023-05-14T16:45:00Z',
    },
  ])
  
  const showCreateDialog = ref(false)
  const editingAgent = ref<Agent | null>(null)
  const saving = ref(false)
  const search = ref('')
  const statusFilter = ref<string | null>(null)
  const typeFilter = ref<string | null>(null)
  
  // Computed
  const filteredAgents = computed(() => {
    return agents.value.filter((agent) => {
      // Search filter
      if (search.value && !agent.name.toLowerCase().includes(search.value.toLowerCase()) &&
          !agent.description.toLowerCase().includes(search.value.toLowerCase())) {
        return false
      }
      
      // Status filter
      if (statusFilter.value && agent.status !== statusFilter.value) {
        return false
      }
      
      // Type filter
      if (typeFilter.value && agent.type !== typeFilter.value) {
        return false
      }
      
      return true
    })
  })
  
  // Methods
  function createAgent(agent: Omit<Agent, 'id' | 'tasksCompleted' | 'tasksRunning' | 'uptime' | 'created'>) {
    saving.value = true
    
    // Simulate API call
    setTimeout(() => {
      const newAgent: Agent = {
        ...agent,
        id: (agents.value.length + 1).toString(),
        tasksCompleted: 0,
        tasksRunning: 0,
        uptime: '0h 0m',
        created: new Date().toISOString(),
      }
      
      agents.value.push(newAgent)
      showCreateDialog.value = false
      saving.value = false
      
      addNotification({
        message: 'Agent created successfully',
        type: 'success',
      })
    }, 500)
  }
  
  function updateAgent(agent: Agent) {
    saving.value = true
    
    // Simulate API call
    setTimeout(() => {
      const index = agents.value.findIndex((a) => a.id === agent.id)
      if (index !== -1) {
        agents.value[index] = { ...agent }
        showCreateDialog.value = false
        saving.value = false
        
        addNotification({
          message: 'Agent updated successfully',
          type: 'success',
        })
      }
    }, 500)
  }
  
  function deleteAgent(agent: Agent) {
    // Simulate API call
    setTimeout(() => {
      agents.value = agents.value.filter((a) => a.id !== agent.id)
      
      addNotification({
        message: 'Agent deleted successfully',
        type: 'success',
      })
    }, 500)
  }
  
  function toggleAgentStatus(agent: Agent) {
    const index = agents.value.findIndex((a) => a.id === agent.id)
    if (index !== -1) {
      const newStatus = agent.status === 'active' ? 'inactive' : 'active'
      agents.value[index] = { ...agent, status: newStatus }
      
      addNotification({
        message: `Agent ${newStatus === 'active' ? 'started' : 'stopped'} successfully`,
        type: 'success',
      })
    }
  }
  
  function duplicateAgent(agent: Agent) {
    const duplicatedAgent: Agent = {
      ...agent,
      id: (agents.value.length + 1).toString(),
      name: `${agent.name} (Copy)`,
      created: new Date().toISOString(),
    }
    
    agents.value.push(duplicatedAgent)
    
    addNotification({
      message: 'Agent duplicated successfully',
      type: 'success',
    })
  }
  
  function viewAgent(agent: Agent) {
    // In a real implementation, this might open a detail view
    console.log('Viewing agent', agent)
  }
  
  function editAgent(agent: Agent) {
    editingAgent.value = { ...agent }
    showCreateDialog.value = true
  }
  
  function openCreateDialog() {
    editingAgent.value = null
    showCreateDialog.value = true
  }
  
  // Utility functions
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
  
  // Return values
  return {
    // State
    agents,
    showCreateDialog,
    editingAgent,
    saving,
    search,
    statusFilter,
    typeFilter,
    
    // Computed
    filteredAgents,
    
    // Methods
    createAgent,
    updateAgent,
    deleteAgent,
    toggleAgentStatus,
    duplicateAgent,
    viewAgent,
    editAgent,
    openCreateDialog,
    
    // Utility functions
    getAgentColor,
    getAgentIcon,
    getStatusColor,
    formatDateTime,
  }
}
