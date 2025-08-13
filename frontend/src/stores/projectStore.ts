import { defineStore } from 'pinia'
import { useOrganizationStore } from '@/stores/organizationStore'
import { apolloClient } from '@/graphql/client'
import gql from 'graphql-tag'

export interface Project {
  id: string
  name: string
  status: string
  description?: string | null
}

export interface ProjectMember {
  id: string
  email: string
  role: string
}

interface ProjectState {
  currentProjectId: string | null
  currentBranch: string
  projects: Project[]
  members: ProjectMember[]
  error: string | null
}

const LIST_PROJECTS = gql`
  query Projects($orgId: ID!) {
    projects(filter: { status: "ACTIVE" }, limit: 100, offset: 0) {
      id
      name
      status
      description
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
    }
  }
`

const DELETE_PROJECT = gql`
  mutation DeleteProject($id: ID!, $orgId: ID!) {
    deleteProject(id: $id, orgId: $orgId)
  }
`

const LIST_MEMBERS = gql`
  query ProjectMembers($projectId: ID!, $orgId: ID!) {
    projectMembers(projectId: $projectId, orgId: $orgId) {
      id
      email
      role
    }
  }
`

const INVITE_MEMBER = gql`
  mutation InviteProjectMember($projectId: ID!, $orgId: ID!, $email: String!, $role: String!) {
    inviteProjectMember(projectId: $projectId, orgId: $orgId, email: $email, role: $role) {
      id
      email
      role
    }
  }
`

const UPDATE_MEMBER_ROLE = gql`
  mutation UpdateProjectMemberRole($projectId: ID!, $orgId: ID!, $memberId: ID!, $role: String!) {
    updateProjectMemberRole(projectId: $projectId, orgId: $orgId, memberId: $memberId, role: $role) {
      id
      email
      role
    }
  }
`

const REMOVE_MEMBER = gql`
  mutation RemoveProjectMember($projectId: ID!, $orgId: ID!, $memberId: ID!) {
    removeProjectMember(projectId: $projectId, orgId: $orgId, memberId: $memberId)
  }
`

export const useProjectStore = defineStore('project', {
  state: (): ProjectState => ({
    currentProjectId: null,
    currentBranch: 'main',
    projects: [],
    members: [],
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
    async fetchMembers(projectId: string) {
      try {
        const orgId = useOrganizationStore().currentOrg?.id
        if (!orgId) throw new Error('Organization not selected')
        const { data } = await apolloClient.query({
          query: LIST_MEMBERS,
          variables: { projectId, orgId },
          fetchPolicy: 'no-cache',
        })
        this.members = data.projectMembers || []
        this.error = null
      } catch (e: any) {
        this.error = e.message || 'Unknown error'
        throw e
      }
    },
    async inviteMember(projectId: string, email: string, role: string) {
      try {
        const orgId = useOrganizationStore().currentOrg?.id
        if (!orgId) throw new Error('Organization not selected')
        const { data } = await apolloClient.mutate({
          mutation: INVITE_MEMBER,
          variables: { projectId, orgId, email, role },
        })
        this.members.push(data.inviteProjectMember)
        this.error = null
        return data.inviteProjectMember as ProjectMember
      } catch (e: any) {
        this.error = e.message || 'Unknown error'
        throw e
      }
    },
    async updateMemberRole(projectId: string, memberId: string, role: string) {
      try {
        const orgId = useOrganizationStore().currentOrg?.id
        if (!orgId) throw new Error('Organization not selected')
        const { data } = await apolloClient.mutate({
          mutation: UPDATE_MEMBER_ROLE,
          variables: { projectId, orgId, memberId, role },
        })
        const idx = this.members.findIndex(m => m.id === memberId)
        if (idx !== -1) this.members[idx] = data.updateProjectMemberRole
        this.error = null
        return data.updateProjectMemberRole as ProjectMember
      } catch (e: any) {
        this.error = e.message || 'Unknown error'
        throw e
      }
    },
    async removeMember(projectId: string, memberId: string) {
      try {
        const orgId = useOrganizationStore().currentOrg?.id
        if (!orgId) throw new Error('Organization not selected')
        await apolloClient.mutate({
          mutation: REMOVE_MEMBER,
          variables: { projectId, orgId, memberId },
        })
        this.members = this.members.filter(m => m.id !== memberId)
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


