<template>
  <v-dialog
    v-model="dialog"
    max-width="500px"
  >
    <v-card>
      <v-card-title>
        <span class="text-h5">Create New Project</span>
      </v-card-title>
      
      <v-card-text>
        <v-form
          ref="form"
          v-model="valid"
        >
          <v-text-field
            v-model="newProject.name"
            label="Project Name"
            :rules="nameRules"
            required
          />
          
          <v-textarea
            v-model="newProject.description"
            label="Description"
            rows="3"
          />
        </v-form>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="blue-darken-1"
          variant="text"
          @click="close"
        >
          Cancel
        </v-btn>
        <v-btn
          color="blue-darken-1"
          variant="text"
          @click="save"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { NewProject } from '../Composables/Interface'

// Define props
const props = defineProps<{
  modelValue: boolean
  project: NewProject
}>()

// Define emits
const emit = defineEmits(['update:modelValue', 'save'])

// Form validation
const valid = ref(false)
const nameRules = [
  (v: string) => !!v || 'Project name is required',
  (v: string) => (v && v.length <= 50) || 'Project name must be less than 50 characters',
]

// Form data
const newProject = computed({
  get: () => props.project,
  set: (_value) => {
    // This is a bit awkward with computed - in a real implementation, 
    // we might want to emit individual field changes instead
  }
})

// Dialog visibility
const dialog = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value)
  }
})

// Methods
const close = () => {
  emit('update:modelValue', false)
}

const save = () => {
  if (valid.value) {
    emit('save', newProject.value)
  }
}
</script>

<style scoped>
/* Add scoped styles here if needed */
</style>
