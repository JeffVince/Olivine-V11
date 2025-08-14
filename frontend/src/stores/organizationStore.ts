import { defineStore } from 'pinia'
import { ref } from 'vue'

interface Organization {
  id: string
  name: string
}



export const useOrganizationStore = defineStore('organization', () => {
  const currentOrg = ref<Organization | null>(null)
  const members = ref<Array<{ id: string; email: string; role: string }>>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  function setOrganization(org: Organization | null) {
    currentOrg.value = org
    if (org) {
      localStorage.setItem('olivine-current-org', JSON.stringify(org))
    } else {
      localStorage.removeItem('olivine-current-org')
    }
  }

  function setMembers(newMembers: Array<{ id: string; email: string; role: string }>) {
    members.value = newMembers
  }

  function clear() {
    currentOrg.value = null
    members.value = []
    localStorage.removeItem('olivine-current-org')
  }

  // Initialize the store with any saved organization
  function initialize() {
    try {
      const savedOrg = localStorage.getItem('olivine-current-org')
      if (savedOrg) {
        currentOrg.value = JSON.parse(savedOrg)
      }
    } catch (e) {
      console.error('Failed to initialize organization store:', e)
      clear()
    }
  }

  return {
    currentOrg,
    members,
    isLoading,
    error,
    setOrganization,
    setMembers,
    clear,
    initialize
  }
})


