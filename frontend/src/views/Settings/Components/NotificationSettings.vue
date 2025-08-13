<template>
  <v-form
    ref="notifForm"
    @submit.prevent="saveNotifications"
  >
    <v-card class="glass-card pa-4 mb-4">
      <v-switch
        v-model="notif.email"
        label="Email"
      />
      <v-switch
        v-model="notif.sms"
        label="SMS"
      />
      <v-switch
        v-model="notif.inApp"
        label="In-App"
      />
      <v-btn
        type="submit"
        color="primary"
      >
        Save
      </v-btn>
    </v-card>
  </v-form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { NotificationSettings } from '../Composables/Interface'

// Props
const props = defineProps<{
  notif: NotificationSettings
}>()

// Emits
const emit = defineEmits(['save'])

// Form reference
const notifForm = ref()

// Methods
async function saveNotifications() {
  emit('save', props.notif)
}
</script>

<style scoped>
/* Scoped styles for this component */
</style>
