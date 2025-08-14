<template>
  <v-menu
    v-model="menu"
    location="bottom end"
  >
    <template #activator="{ props }">
      <v-btn
        v-bind="props"
        icon
        class="liquid-button"
      >
        <v-badge
          v-if="unread > 0"
          :content="unread"
          color="error"
          overlap
        >
          <v-icon>mdi-bell</v-icon>
        </v-badge>
        <v-icon v-else>
          mdi-bell
        </v-icon>
      </v-btn>
    </template>
    <v-list style="min-width: 300px">
      <v-list-item
        v-for="item in items"
        :key="item.id"
        @click="open(item)"
      >
        <v-list-item-title :class="{ 'font-weight-medium': !item.read }">
          {{ item.message }}
        </v-list-item-title>
        <v-list-item-subtitle>{{ formatDate(item.createdAt) }}</v-list-item-subtitle>
      </v-list-item>
      <v-list-item
        v-if="items.length === 0"
        title="No notifications"
      />
      <v-divider />
      <v-list-item>
        <v-btn
          variant="text"
          @click="clear"
        >
          Clear All
        </v-btn>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useNotificationStore, type NotificationItem } from '@/stores/notificationStore'
import { useRouter } from 'vue-router'

const menu = ref(false)
const store = useNotificationStore()
const router = useRouter()

const items = store.items
const unread = store.unreadCount

function open(item: NotificationItem) {
  store.markRead(item.id)
  menu.value = false
  if (item.link) router.push(item.link)
}

function clear() {
  store.clear()
}

function formatDate(date: string) {
  return new Date(date).toLocaleString()
}

watch(menu, (v) => {
  if (v) store.markAllRead()
})
</script>
