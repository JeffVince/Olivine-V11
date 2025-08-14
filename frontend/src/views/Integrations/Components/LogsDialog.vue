<template>
  <v-dialog 
    v-model="showDialog" 
    max-width="800px"
  >
    <v-card class="glass-card">
      <v-card-title>
        Integration Logs - {{ logsIntegration?.name }}
      </v-card-title>
      <v-card-text>
        <v-list>
          <v-list-item 
            v-for="log in logs" 
            :key="log.id"
            class="log-entry"
            :class="`log-${log.level}`"
          >
            <div class="d-flex align-start">
              <div class="log-timestamp">
                {{ formatDateTime(log.timestamp) }}
              </div>
              <v-chip 
                :color="getLogLevelColor(log.level)"
                size="x-small"
                class="log-level mr-2 mt-1"
              >
                {{ log.level }}
              </v-chip>
              <div class="log-message">
                {{ log.message }}
              </div>
            </div>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn 
          color="primary" 
          variant="flat" 
          @click="$emit('close')"
        >
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Integration, LogEntry } from '@/views/Integrations/Composables/Interface'
import { formatDateTime, getLogLevelColor } from '@/views/Integrations/Composables/utils'

// Props
const props = defineProps<{
  modelValue: boolean
  logsIntegration: Integration | null
  logs: LogEntry[]
}>()

// Emits
const emit = defineEmits(['update:modelValue', 'close'])

// Reactive variables
const showDialog = ref(props.modelValue)

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

.log-entry {
  border-left: 3px solid #e0e0e0;
  padding-left: 12px;
  margin-bottom: 8px;
  
  &.log-error {
    border-left-color: #f44336;
  }
  
  &.log-warn {
    border-left-color: #ff9800;
  }
  
  &.log-success {
    border-left-color: #4caf50;
  }
  
  &.log-info {
    border-left-color: #2196f3;
  }
}

.log-timestamp {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-right: 8px;
}

.log-message {
  flex: 1;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.log-level {
  text-transform: uppercase;
  font-weight: 500;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
