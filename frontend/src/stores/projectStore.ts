import { defineStore } from 'pinia'
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
  status: string
  description?: string | null
  settings?: ProjectSettings
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

export const useProjectStore = defineStore('project', {
  state: (): ProjectState => ({
    currentProjectId: null,
    currentBranch: 'main',
    projects: [],
    error: null,
  }),
  actions: {
    setProject(id: string | null) {
      this.currentProjectId = id
      if (id) {
        localStorage.setItem('olivine-current-project', id)
      } else {
        localStorage.removeItem('olivine-current-project')
      }
    },
    setBranch(name: string) {
      this.currentBranch = name
    },
    async fetchProjects() {
      try {
        const orgId = useOrganizationStore().currentOrg?.id
        if (!orgId) throw new Error('Organization not selected')
        const { data } = await apolloClient.query({
          query: LIST_PROJECTS,
          variables: { orgId },
          fetchPolicy: 'no-cache',
        })
        this.projects = data.projects || []
        this.error = null
      } catch (e: any) {
        this.error = e.message || 'Unknown error'
        throw e
      }
    },
    async createProject(input: { name: string; description?: string; settings?: any }) {
      try {
        const orgId = useOrganizationStore().currentOrg?.id
        if (!orgId) throw new Error('Organization not selected')
        const { data } = await apolloClient.mutate({
          mutation: CREATE_PROJECT,
          variables: { input: { orgId, ...input } },
        })
        this.projects.push(data.createProject)
        this.error = null
        return data.createProject as Project
      } catch (e: any) {
        this.error = e.message || 'Unknown error'
        throw e
      }
    },
    async editProject(id: string, name: string) {
      try {
        const orgId = useOrganizationStore().currentOrg?.id
        if (!orgId) throw new Error('Organization not selected')
        const { data } = await apolloClient.mutate({
          mutation: UPDATE_PROJECT,
          variables: { input: { id, orgId, name } },
        })
        const idx = this.projects.findIndex(p => p.id === id)
        if (idx !== -1) this.projects[idx] = data.updateProject
        this.error = null
        return data.updateProject as Project
      } catch (e: any) {
        this.error = e.message || 'Unknown error'
        throw e
      }
    },
    async updateProjectOptions(id: string, options: { name: string; templates: string[]; autoApprove: boolean }) {
      try {
        const orgId = useOrganizationStore().currentOrg?.id
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
        const idx = this.projects.findIndex(p => p.id === id)
        if (idx !== -1) this.projects[idx] = data.updateProject
        this.error = null
        return data.updateProject as Project
      } catch (e: any) {
        this.error = e.message || 'Unknown error'
        throw e
      }
    },
    async archiveProject(id: string) {
      try {
        const orgId = useOrganizationStore().currentOrg?.id
        if (!orgId) throw new Error('Organization not selected')
        const { data } = await apolloClient.mutate({
          mutation: UPDATE_PROJECT,
          variables: { input: { id, orgId, status: 'ARCHIVED' } },
        })
        const idx = this.projects.findIndex(p => p.id === id)
        if (idx !== -1) this.projects[idx] = data.updateProject
        this.error = null
        return data.updateProject as Project
      } catch (e: any) {
        this.error = e.message || 'Unknown error'
        throw e
      }
    },
    async deleteProject(id: string) {
      try {
        const orgId = useOrganizationStore().currentOrg?.id
        if (!orgId) throw new Error('Organization not selected')
        await apolloClient.mutate({
          mutation: DELETE_PROJECT,
          variables: { id, orgId },
        })
        this.projects = this.projects.filter(p => p.id !== id)
        if (this.currentProjectId === id) this.setProject(null)
        this.error = null
      } catch (e: any) {
        this.error = e.message || 'Unknown error'
        throw e
      }
    },
    initializeProject() {
      const storedProjectId = localStorage.getItem('olivine-current-project')
      if (storedProjectId) {
        this.currentProjectId = storedProjectId
      }
    },
  },
})


