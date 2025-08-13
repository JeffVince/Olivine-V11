export interface Project {
  id: string
  name: string
  status: 'active' | 'syncing' | 'error' | 'archived'
  description?: string | null
  settings?: {
    templates: string[]
    autoApprove: boolean
  }
  lastActivity?: string
  integrations?: Array<{
    type: 'dropbox' | 'googledrive' | 'frameio'
    connected: boolean
  }>
}

export interface Integration {
  id: string
  name: string
  type: string
}

export interface NewProject {
  name: string
  description?: string
  settings?: Record<string, unknown>
}

export interface ProjectState {
  projects: Project[]
  showCreateDialog: boolean
  showEditDialog: boolean
  selectedProject: Project | null
  newProject: NewProject
  loading: boolean
}
