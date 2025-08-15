import { ref, computed } from 'vue'
import type { Project, NewProject } from './Interface'
import { useProjectStore } from '@/stores/projectStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useRouter } from 'vue-router'

// State - Single source of truth for all reactive variables
export const showCreateDialog = ref(false)
export const showEditDialog = ref(false)
export const showDeleteDialog = ref(false)
export const selectedProject = ref<Project | null>(null)
export const newProject = ref<NewProject>({
  title: '',
  type: 'feature_film',
  status: 'development'
})
export const loading = ref(false)

// Get projects from the project store
const projectStore = useProjectStore()
export const projects = computed(() => projectStore.projects)

// Router
const router = useRouter()

// Notification store
const notificationStore = useNotificationStore()

// Methods
export const openProject = (id: string) => {
  router.push(`/projects/${id}`)
}

export const editProject = (project: Project) => {
  selectedProject.value = project
  showEditDialog.value = true
}

export const archiveProject = (project: Project) => {
  projectStore.archiveProject(project.id)
  notificationStore.add('success', `Project ${project.title} archived successfully`)
}

export const deleteProject = (project: Project) => {
  selectedProject.value = project
  showDeleteDialog.value = true
}

export const confirmDelete = () => {
  if (selectedProject.value) {
    projectStore.deleteProject(selectedProject.value.id)
    notificationStore.add('success', `Project ${selectedProject.value.title} deleted successfully`)
    showDeleteDialog.value = false
  }
}

export const createProject = () => {
  projectStore.createProject(newProject.value)
  notificationStore.add('success', 'Project created successfully')
  showCreateDialog.value = false
  // Reset form
  newProject.value = {
    title: '',
    type: 'feature_film',
    status: 'development'
  }
}

// Utility functions for UI
export const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'success'
    case 'error': return 'error'
    case 'archived': return 'warning'
    case 'syncing': return 'info'
    default: return 'grey'
  }
}

export const getIntegrationIcon = (type: string) => {
  switch (type) {
    case 's3': return 'mdi-aws'
    case 'gcs': return 'mdi-google-cloud'
    case 'azure': return 'mdi-microsoft-azure'
    case 'local': return 'mdi-folder'
    default: return 'mdi-help-circle'
  }
}

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

export const getIntegrationColor = (type: string) => {
  switch (type) {
    case 's3': return '#FF9900'
    case 'gcs': return '#4285F4'
    case 'azure': return '#0078D4'
    case 'local': return '#616161'
    default: return '#9E9E9E'
  }
}
