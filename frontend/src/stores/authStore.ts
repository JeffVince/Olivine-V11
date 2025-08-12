import { defineStore } from 'pinia'

interface UserProfile {
  id: string
  email: string
  name?: string
  roles: string[]
}

interface AuthState {
  accessToken: string | null
  user: UserProfile | null
  status: 'idle' | 'authenticated' | 'unauthenticated'
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    accessToken: null,
    user: null,
    status: 'idle',
  }),
  getters: {
    isAuthenticated: (state) => !!state.accessToken,
    hasRole: (state) => (role: string) => state.user?.roles.includes(role) ?? false,
  },
  actions: {
    setToken(token: string | null) {
      this.accessToken = token
      this.status = token ? 'authenticated' : 'unauthenticated'
    },
    setUser(user: UserProfile | null) {
      this.user = user
    },
    logout() {
      this.accessToken = null
      this.user = null
      this.status = 'unauthenticated'
    },
  },
})


