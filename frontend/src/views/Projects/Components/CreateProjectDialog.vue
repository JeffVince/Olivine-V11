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
            v-model="newProject.title"
            label="Project Title"
            :rules="titleRules"
            required
          />
          
          <v-select
            v-model="newProject.type"
            :items="projectTypes"
            label="Project Type"
            :rules="typeRules"
            required
          />
          
          <v-select
            v-model="newProject.status"
            :items="projectStatuses"
            label="Status"
            :rules="statusRules"
            required
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
          :disabled="!valid"
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
import { useProjectStore } from '@/stores/projectStore'

// Props
const props = defineProps({
  modelValue: Boolean
})

// Emits
const emit = defineEmits(['update:modelValue', 'project-created'])

// Stores
const projectStore = useProjectStore()

// Form validation
const valid = ref(false)
const titleRules = [
  (v: string) => !!v || 'Project title is required',
  (v: string) => (v && v.length <= 50) || 'Project title must be less than 50 characters'
]
const typeRules = [
  (v: string) => !!v || 'Project type is required'
]
const statusRules = [
  (v: string) => !!v || 'Project status is required'
]

// Project types and statuses
const projectTypes = [
  { title: 'Feature Film', value: 'feature_film' },
  { title: 'TV Series', value: 'tv_series' },
  { title: 'Commercial', value: 'commercial' },
  { title: 'Documentary', value: 'documentary' },
  { title: 'Short Film', value: 'short_film' }
]

const projectStatuses = [
  { title: 'Development', value: 'development' },
  { title: 'Pre Production', value: 'pre_production' },
  { title: 'Production', value: 'production' },
  { title: 'Post Production', value: 'post_production' },
  { title: 'Completed', value: 'completed' },
  { title: 'Cancelled', value: 'cancelled' }
]

// Form data
const newProject = ref({
  title: '',
  type: 'feature_film',
  status: 'development'
})

// Computed dialog visibility
const dialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Methods
function close() {
  dialog.value = false
  newProject.value = { title: '', type: 'feature_film', status: 'development' }
  valid.value = false
}

async function save() {
  if (!valid.value) return
  
  try {
    const project = await projectStore.createProject({
      title: newProject.value.title,
      type: newProject.value.type,
      status: newProject.value.status
    })
    
    emit('project-created', project)
    close()
  } catch (error) {
    console.error('Error creating project:', error)
  }
}
</script>

<style scoped>
/* Add scoped styles here if needed */
</style>
