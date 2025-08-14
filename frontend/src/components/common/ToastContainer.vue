<template>
  <v-snackbar
    v-model="visible"
    :color="current?.level"
    location="bottom right"
    timeout="5000"
  >
    <div class="accent-amber">
      {{ current?.message }}
    </div>
    <template #actions>
      <v-btn
        icon
        class="liquid-button"
        @click="visible = false"
      >
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useNotificationStore, type NotificationItem } from '@/stores/notificationStore'

const store = useNotificationStore()
const visible = ref(false)
const current = ref<NotificationItem | null>(null)
const lastId = ref<string | undefined>()

watch(
  () => store.items[0],
  (item) => {
    if (item && item.id !== lastId.value) {
      current.value = item
      visible.value = true
      lastId.value = item.id
    }
  }
)
</script>
