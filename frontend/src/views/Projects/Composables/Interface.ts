export interface Project {
  id: string
  orgId: string
  title: string
  status: 'development' | 'pre_production' | 'production' | 'post_production' | 'completed' | 'cancelled'
  settings?: Record<string, any>
  metadata?: Record<string, any>
  createdAt?: string
  updatedAt?: string
}

export interface Integration {
  id: string
  name: string
  type: string
}

export interface NewProject {
  title: string
  type: string
  status: string
  start_date?: string
  budget?: number
  metadata?: Record<string, any>
}

export interface ProjectState {
  projects: Project[]
  showCreateDialog: boolean
  showEditDialog: boolean
  selectedProject: Project | null
  newProject: NewProject
  loading: boolean
}
