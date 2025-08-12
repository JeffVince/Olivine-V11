import { defineStore } from 'pinia'

interface Organization {
  id: string
  name: string
}

interface OrganizationState {
  currentOrg: Organization | null
  members: Array<{ id: string; email: string; role: string }>
}

export const useOrganizationStore = defineStore('organization', {
  state: (): OrganizationState => ({
    currentOrg: null,
    members: [],
  }),
  actions: {
    setOrganization(org: Organization | null) {
      this.currentOrg = org
    },
    setMembers(members: Array<{ id: string; email: string; role: string }>) {
      this.members = members
    },
    clear() {
      this.currentOrg = null
      this.members = []
    },
  },
})


