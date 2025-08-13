<template>
  <v-dialog 
    v-model="showDialog" 
    max-width="500px"
  >
    <v-card class="glass-card">
      <v-card-title>
        Add New Integration
      </v-card-title>
      <v-card-text>
        <v-text-field
          v-model="newIntegration.name"
          label="Integration Name"
          required
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn 
          color="error" 
          variant="text" 
          @click="$emit('cancel')"
        >
          Cancel
        </v-btn>
        <v-btn 
          color="primary" 
          variant="flat" 
          @click="$emit('proceed')"
        >
          Continue
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { NewIntegration } from '@/views/Integrations/Composables/Interface'

// Props
const props = defineProps<{
  modelValue: boolean
  newIntegration: NewIntegration
}>()

// Emits
const emit = defineEmits(['update:modelValue', 'cancel', 'proceed'])

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
</style>
