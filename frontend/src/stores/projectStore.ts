import { defineStore } from 'pinia'

interface ProjectState {
  currentProjectId: string | null
  currentBranch: string
}

export const useProjectStore = defineStore('project', {
  state: (): ProjectState => ({
    currentProjectId: null,
    currentBranch: 'main',
  }),
  actions: {
    setProject(id: string | null) {
      this.currentProjectId = id
      // Store in localStorage for persistence
      if (id) {
        localStorage.setItem('olivine-current-project', id)
      } else {
        localStorage.removeItem('olivine-current-project')
      }
    },
    setBranch(name: string) {
      this.currentBranch = name
    },
    initializeProject() {
      // Try to restore from localStorage first
      const storedProjectId = localStorage.getItem('olivine-current-project')
      if (storedProjectId) {
        this.currentProjectId = storedProjectId
        return
      }
      
      // If no stored project, set a default project for demo purposes
      // In a real app, this would check if projects exist via API
      const defaultProjectId = 'demo-project-1'
      this.setProject(defaultProjectId)
    },
  },
})


