import { defineStore } from 'pinia'

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export interface NotificationItem {
  id: string
  level: NotificationLevel
  message: string
  createdAt: string
  link?: string
  read: boolean
}

interface NotificationState {
  items: NotificationItem[]
}

export const useNotificationStore = defineStore('notifications', {
  state: (): NotificationState => ({ items: [] }),
  getters: {
    count: (state) => state.items.length,
    unreadCount: (state) => state.items.filter((i) => !i.read).length,
  },
  actions: {
    add(level: NotificationLevel, message: string, link?: string) {
      this.items.unshift({
        id: `${Date.now()}:${Math.random().toString(36).slice(2)}`,
        level,
        message,
        link,
        createdAt: new Date().toISOString(),
        read: false,
      })
    },
    markRead(id: string) {
      const item = this.items.find((i) => i.id === id)
      if (item) item.read = true
    },
    markAllRead() {
      this.items.forEach((i) => (i.read = true))
    },
    remove(id: string) {
      this.items = this.items.filter((i) => i.id !== id)
    },
    clear() {
      this.items = []
    },
  },
})
