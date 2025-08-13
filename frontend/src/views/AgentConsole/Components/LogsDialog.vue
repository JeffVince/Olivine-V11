<template>
  <v-dialog v-model="model" max-width="800" persistent>
    <v-card>
      <v-card-title>Job Logs</v-card-title>
      <v-card-text style="max-height: 60vh; overflow: auto;">
        <v-list v-if="logs.length">
          <v-list-item
            v-for="log in logs"
            :key="log.timestamp + log.message"
          >
            <v-list-item-title>
              <strong>{{ new Date(log.timestamp).toLocaleString() }}</strong>
              <v-chip
                :color="log.level === 'error' ? 'error' : log.level === 'warn' ? 'warning' : 'info'"
                size="x-small"
                class="ml-2"
                variant="tonal"
              >
                {{ log.level }}
              </v-chip>
            </v-list-item-title>
            <v-list-item-subtitle class="mt-1">
              {{ log.message }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
        <div
          v-else
          class="text-medium-emphasis"
        >
          No logs available for this job.
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="closeDialog">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Log } from '../Composables/Interface'

interface Props {
  modelValue: boolean
  logs: Log[]
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const model = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

function closeDialog() {
  emit('update:modelValue', false)
}
</script>
