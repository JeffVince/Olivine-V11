import type { NotificationItem } from '@/stores/notificationStore'

export interface NotificationsState {
  notifications: NotificationItem[]
}

export interface NotificationActions {
  open: (n: NotificationItem) => void
  remove: (id: string) => void
  clear: () => void
  formatDate: (date: string) => string
}
