import { defineStore } from 'pinia'
import { apolloClient } from '@/graphql/client'
import gql from 'graphql-tag'

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


