<template>
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
</template>

<script setup lang="ts">
import type { NotificationItem } from '@/stores/notificationStore'
import type { PropType } from 'vue'

// Props
const props = defineProps({
  notifications: {
    type: Array as PropType<NotificationItem[]>,
    required: true
  },
  formatDate: {
    type: Function as PropType<(date: string) => string>,
    required: true
  }
})

// Emits
const emit = defineEmits(['open', 'remove', 'clear'])

// Methods
function open(n: NotificationItem) {
  emit('open', n)
}

function remove(id: string) {
  emit('remove', id)
}

function clear() {
  emit('clear')
}
</script>

<style scoped>
/* Scoped styles for this component */
</style>
