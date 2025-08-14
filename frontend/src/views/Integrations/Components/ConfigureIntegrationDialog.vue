<template>
  <v-dialog 
    v-model="showDialog" 
    max-width="600px"
  >
    <v-card class="glass-card">
      <v-card-title>
        Configure {{ selectedIntegration?.name }}
      </v-card-title>
      <v-card-text>
        <v-text-field
          v-model="rootFolderProxy"
          label="Root Folder Path"
        />
        <!-- <v-switch
          v-model="selectedIntegrationEnableWebhooks"
          label="Enable Webhooks"
        /> -->
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn 
          color="error" 
          variant="text" 
          @click="$emit('close')"
        >
          Cancel
        </v-btn>
        <v-btn 
          color="primary" 
          variant="flat" 
          @click="$emit('save')"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Integration } from '@/views/Integrations/Composables/Interface'

// Props
const props = defineProps<{
  modelValue: boolean
  selectedIntegration: Integration | null
  selectedIntegrationRootFolder: string
  selectedIntegrationEnableWebhooks: boolean
}>()

// Emits
const emit = defineEmits(['update:modelValue', 'update:selectedIntegrationRootFolder', 'update:selectedIntegrationEnableWebhooks', 'close', 'save'])

// Reactive variables
const showDialog = ref(props.modelValue)

// Computed proxies to avoid mutating props directly with v-model
const rootFolderProxy = computed({
  get: () => props.selectedIntegrationRootFolder,
  set: (val: string) => emit('update:selectedIntegrationRootFolder', val),
})

// If/when enabling the switch again, use a similar proxy:
// const enableWebhooksProxy = computed({
//   get: () => props.selectedIntegrationEnableWebhooks,
//   set: (val: boolean) => emit('update:selectedIntegrationEnableWebhooks', val),
// })

// Watch for changes
watch(() => props.modelValue, (newValue) => {
  showDialog.value = newValue
})

watch(showDialog, (newValue) => {
  emit('update:modelValue', newValue)
})
</script>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.7) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
</style>
