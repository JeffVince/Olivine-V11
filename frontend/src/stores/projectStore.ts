import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useOrganizationStore } from '@/stores/organizationStore'
import { apolloClient } from '@/graphql/client'
import gql from 'graphql-tag'

export interface ProjectSettings {
  templates: string[]
  autoApprove: boolean
}

export interface Project {
  id: string
  name: string
  status: 'active' | 'syncing' | 'error' | 'archived'
  description?: string | null
  settings?: ProjectSettings
  lastActivity?: string
  integrations?: Array<{
    type: 'dropbox' | 'googledrive' | 'frameio'
    connected: boolean
  }>
}

interface ProjectState {
  currentProjectId: string | null
  currentBranch: string
  projects: Project[]
  error: string | null
}

const LIST_PROJECTS = gql`
  query Projects($orgId: ID!) {
    projects(filter: { status: "ACTIVE" }, limit: 100, offset: 0) {
      id
      name
      status
      description
      settings
    }
  }
`

const CREATE_PROJECT = gql`
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      name
      status
      description
      settings
    }
  }
`

const UPDATE_PROJECT = gql`
  mutation UpdateProject($input: UpdateProjectInput!) {
    updateProject(input: $input) {
      id
      name
      status
      description
      settings
    }
  }
`

const DELETE_PROJECT = gql`
  mutation DeleteProject($id: ID!, $orgId: ID!) {
    deleteProject(id: $id, orgId: $orgId)
  }
`

export const useProjectStore = defineStore('project', () => {
  const currentProjectId = ref<string | null>(localStorage.getItem('olivine-current-project'))
  const currentBranch = ref('main')
  const projects = ref<Project[]>([])
  const error = ref<string | null>(null)
  const isLoading = ref(false)
  
  const organizationStore = useOrganizationStore()
  
  const currentProject = computed(() => 
    currentProjectId.value 
      ? projects.value.find(p => p.id === currentProjectId.value) || null 
      : null
  )
  
  function setProject(id: string | null) {
    currentProjectId.value = id
    if (id) {
      localStorage.setItem('olivine-current-project', id)
    } else {
      localStorage.removeItem('olivine-current-project')
    }
  }
  
  function setBranch(name: string) {
    currentBranch.value = name
  }
  
  async function fetchProjects() {
    try {
      if (!organizationStore.currentOrg?.id) {
        throw new Error('Organization not selected')
      }
      
      isLoading.value = true
      error.value = null
      
      const { data } = await apolloClient.query({
        query: LIST_PROJECTS,
        variables: { orgId: organizationStore.currentOrg.id },
        fetchPolicy: 'no-cache',
      })
      
      projects.value = data.projects || []
      return projects.value
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      error.value = `Failed to fetch projects: ${message}`
      console.error(error.value, e)
      throw e
    } finally {
      isLoading.value = false
    }
  }
  
  async function createProject(input: { name: string; description?: string; settings?: Record<string, unknown> }) {
    try {
      const orgId = organizationStore.currentOrg?.id
      if (!orgId) throw new Error('Organization not selected')
      const { data } = await apolloClient.mutate({
        mutation: CREATE_PROJECT,
        variables: { input: { orgId, ...input } },
      })
      projects.value.push(data.createProject)
      error.value = null
      return data.createProject as Project
    } catch (e: unknown) {
      error.value = (e as Error).message || 'Unknown error'
      throw e
    }
  }
  
  async function editProject(id: string, name: string) {
    try {
      const orgId = organizationStore.currentOrg?.id
      if (!orgId) throw new Error('Organization not selected')
      const { data } = await apolloClient.mutate({
        mutation: UPDATE_PROJECT,
        variables: { input: { id, orgId, name } },
      })
      const idx = projects.value.findIndex(p => p.id === id)
      if (idx !== -1) projects.value[idx] = data.updateProject
      error.value = null
      return data.updateProject as Project
    } catch (e: unknown) {
      error.value = (e as Error).message || 'Unknown error'
      throw e
    }
  }
  
  async function updateProjectOptions(id: string, options: { name: string; templates: string[]; autoApprove: boolean }) {
    try {
      const orgId = organizationStore.currentOrg?.id
      if (!orgId) throw new Error('Organization not selected')
      const { data } = await apolloClient.mutate({
        mutation: UPDATE_PROJECT,
        variables: {
          input: {
            id,
            orgId,
            name: options.name,
            settings: { templates: options.templates, autoApprove: options.autoApprove },
          },
        },
      })
      const idx = projects.value.findIndex(p => p.id === id)
      if (idx !== -1) projects.value[idx] = data.updateProject
      error.value = null
      return data.updateProject as Project
    } catch (e: unknown) {
      error.value = (e as Error).message || 'Unknown error'
      throw e
    }
  }
  
  async function archiveProject(id: string) {
    try {
      const orgId = organizationStore.currentOrg?.id
      if (!orgId) throw new Error('Organization not selected')
      const { data } = await apolloClient.mutate({
        mutation: UPDATE_PROJECT,
        variables: { input: { id, orgId, status: 'ARCHIVED' } },
      })
      const idx = projects.value.findIndex(p => p.id === id)
      if (idx !== -1) projects.value[idx] = data.updateProject
      error.value = null
      return data.updateProject as Project
    } catch (e: unknown) {
      error.value = (e as Error).message || 'Unknown error'
      throw e
    }
  }
  
  async function deleteProject(id: string) {
    try {
      const orgId = organizationStore.currentOrg?.id
      if (!orgId) throw new Error('Organization not selected')
      await apolloClient.mutate({
        mutation: DELETE_PROJECT,
        variables: { id, orgId },
      })
      projects.value = projects.value.filter(p => p.id !== id)
      if (currentProjectId.value === id) setProject(null)
      error.value = null
    } catch (e: unknown) {
      error.value = (e as Error).message || 'Unknown error'
      throw e
    }
  }
  
  function initializeProject() {
    const savedProjectId = localStorage.getItem('olivine-current-project')
    if (savedProjectId) {
      setProject(savedProjectId)
    }
    
    // If we have an organization but no projects, try to fetch them
    if (organizationStore.currentOrg?.id && projects.value.length === 0) {
      fetchProjects().catch(err => {
        console.error('Failed to initialize projects:', err)
      })
    }
  }
  
  // Return all the state and actions
  return {
    // State
    currentProjectId,
    currentBranch,
    projects,
    error,
    isLoading,
    
    // Computed
    currentProject,
    
    // Actions
    setProject,
    setBranch,
    fetchProjects,
    initializeProject,
    createProject,
    editProject,
    updateProjectOptions,
    archiveProject,
    deleteProject
  }
})


