<template>
  <v-form
    ref="notifForm"
    @submit.prevent="saveNotifications"
  >
    <v-card class="glass-card pa-4 mb-4">
      <v-switch
        v-model="localNotif.email"
        label="Email"
      />
      <v-switch
        v-model="localNotif.sms"
        label="SMS"
      />
      <v-switch
        v-model="localNotif.inApp"
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
import { ref, watch } from 'vue'
import type { NotificationSettings } from '../Composables/Interface'

// Props
const props = defineProps<{
  notif: NotificationSettings
}>()

// Emits
const emit = defineEmits(['update:notif', 'save'])

// Create a local copy of the prop
const localNotif = ref<NotificationSettings>({ ...props.notif })

// Form reference
const notifForm = ref()

// Methods
async function saveNotifications() {
  emit('save', localNotif.value)
  emit('update:notif', localNotif.value)
}

// Watch for prop changes and update local copy
watch(() => props.notif, () => {
  localNotif.value = { ...props.notif }
})
</script>

<style scoped>
/* Scoped styles for this component */
</style>
