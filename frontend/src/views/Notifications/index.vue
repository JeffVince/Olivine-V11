<template>
  <div>
    <NotificationsHeader />
    <NotificationsList 
      :notifications="notifications"
      :format-date="formatDate"
      @open="open"
      @remove="remove"
      @clear="clear"
    />
  </div>
</template>

<script setup lang="ts">
import { useNotificationsState, useNotificationsActions } from '@/views/Notifications/Composables'

// Import components
import NotificationsHeader from '@/views/Notifications/Components/NotificationsHeader.vue'
import NotificationsList from '@/views/Notifications/Components/NotificationsList.vue'

// Initialize notifications state and actions
const { notifications } = useNotificationsState()
const { open, remove, clear, formatDate } = useNotificationsActions()
</script>

<style scoped>
/* Scoped styles for this component */
</style>