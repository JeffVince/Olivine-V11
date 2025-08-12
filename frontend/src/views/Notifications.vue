<template>
  <div>
    <h2>Notifications & Inbox</h2>
    <v-card>
      <v-list density="compact">
        <v-list-item v-for="n in notifications" :key="n.id" :title="n.message" :subtitle="n.createdAt" />
      </v-list>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { useNotificationStore } from '@/stores/notificationStore'
const notifications = useNotificationStore().items
</script>


