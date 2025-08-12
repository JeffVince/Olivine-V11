import { defineStore } from 'pinia'

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export interface NotificationItem {
  id: string
  level: NotificationLevel
  message: string
  createdAt: string
  link?: string
}

interface NotificationState {
  items: NotificationItem[]
}

export const useNotificationStore = defineStore('notifications', {
  state: (): NotificationState => ({ items: [] }),
  getters: {
    count: (state) => state.items.length,
  },
  actions: {
    add(level: NotificationLevel, message: string, link?: string) {
      this.items.unshift({
        id: `${Date.now()}:${Math.random().toString(36).slice(2)}`,
        level,
        message,
        link,
        createdAt: new Date().toISOString(),
      })
    },
    clear() {
      this.items = []
    },
  },
})


