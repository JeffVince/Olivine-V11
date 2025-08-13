<template>
  <div>
    <h2>Notifications & Inbox</h2>
    <v-card class="glass-card">
      <v-list density="comfortable">
        <v-list-item
          v-for="n in notifications"
          :key="n.id"
          @click="open(n)"
        >
          <v-list-item-title :class="{ 'font-weight-medium': !n.read }">
            {{ n.message }}
          </v-list-item-title>
          <v-list-item-subtitle>{{ formatDate(n.createdAt) }}</v-list-item-subtitle>
          <template #append>
            <v-btn
              icon="mdi-close"
              @click.stop="remove(n.id)"
            />
          </template>
        </v-list-item>
        <v-list-item
          v-if="notifications.length === 0"
          title="No notifications"
        />
      </v-list>
      <v-card-actions>
        <v-btn
          variant="text"
          @click="clear"
        >
          Clear All
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { useNotificationStore, type NotificationItem } from '@/stores/notificationStore'
import { useRouter } from 'vue-router'

const store = useNotificationStore()
const router = useRouter()
const notifications = store.items

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
</script>
