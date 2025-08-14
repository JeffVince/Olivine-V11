import { defineStore } from 'pinia'
import { apolloClient } from '@/graphql/client'
import gql from 'graphql-tag'
import { useOrganizationStore } from './organizationStore'

interface UserProfile {
  id: string
  email: string
  name?: string
  avatar?: string
  roles: string[]
}

export interface NotificationPrefs {
  email: boolean
  sms: boolean
  inApp: boolean
}

interface AuthState {
  accessToken: string | null
  user: UserProfile | null
  status: 'idle' | 'authenticated' | 'unauthenticated'
  notificationPrefs: NotificationPrefs
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    accessToken: null,
    user: null,
    status: 'idle',
    notificationPrefs: { email: true, sms: false, inApp: true },
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
    async login(email: string, password: string) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      if (!res.ok) throw new Error('Login failed')
      const data = await res.json()
      this.setToken(data.token)
      this.setUser({ id: data.userId, email, roles: [data.role] })
      const orgStore = useOrganizationStore()
      orgStore.setOrganization({ id: data.orgId, name: '' })
    },
    async register(orgName: string, email: string, password: string) {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName, email, password })
      })
      if (!res.ok) throw new Error('Registration failed')
      const data = await res.json()
      this.setToken(data.token)
      this.setUser({ id: data.userId, email, roles: [data.role] })
      const orgStore = useOrganizationStore()
      orgStore.setOrganization({ id: data.orgId, name: orgName })
    },
    async updateProfile(input: { name: string; avatar?: string }) {
      await apolloClient.mutate({
        mutation: gql`
          mutation UpdateProfile($input: UpdateProfileInput!) {
            updateProfile(input: $input) { id name avatar }
          }
        `,
        variables: { input },
      })
      if (this.user) {
        this.user.name = input.name
        this.user.avatar = input.avatar
      }
    },
    async updateNotificationPrefs(prefs: NotificationPrefs) {
      await apolloClient.mutate({
        mutation: gql`
          mutation UpdateNotificationPrefs($input: NotificationPrefsInput!) {
            updateNotificationPrefs(input: $input) { email sms inApp }
          }
        `,
        variables: { input: prefs },
      })
      this.notificationPrefs = { ...prefs }
    },
  },
})


