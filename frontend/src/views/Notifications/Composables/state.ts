import { useNotificationStore, type NotificationItem } from '@/stores/notificationStore'
import { useRouter } from 'vue-router'
import { computed } from 'vue'

const store = useNotificationStore()
const router = useRouter()

export function useNotificationsState() {
  const notifications = computed(() => store.items)
  
  return {
    notifications
  }
}

export function useNotificationsActions() {
  function open(n: NotificationItem) {
    store.markRead(n.id)
    if (n.link) router.push(n.link)
  }
  
  function remove(id: string) {
    store.remove(id)
  }
  
  function clear() {
    store.clear()
  }
  
  function formatDate(date: string) {
    return new Date(date).toLocaleString()
  }
  
  return {
    open,
    remove,
    clear,
    formatDate
  }
}

export function useNotificationsLifecycle() {
  // Any initialization logic would go here if needed
}
