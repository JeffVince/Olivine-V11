<template>
  <v-dialog 
    :model-value="modelValue" 
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="500px"
  >
    <v-card>
      <v-card-title>
        <span class="text-h5">Create New Mapping</span>
      </v-card-title>
      
      <v-card-text>
        <v-form ref="form" v-model="valid">
          <v-text-field
            v-model="localMapping.name"
            label="Mapping Name"
            prepend-icon="mdi-form-textbox"
            :rules="[v => !!v || 'Name is required']"
            required
          />
          
          <v-textarea
            v-model="localMapping.description"
            label="Description"
            prepend-icon="mdi-text"
            rows="3"
          />
          
          <v-select
            v-model="localMapping.type"
            :items="mappingTypes"
            label="Mapping Type"
            prepend-icon="mdi-format-list-bulleted-type"
            :rules="[v => !!v || 'Type is required']"
            required
          />
          
          <v-select
            v-model="localMapping.sourceType"
            :items="sourceTypes"
            label="Source Type"
            prepend-icon="mdi-database"
            :rules="[v => !!v || 'Source type is required']"
            required
          />
        </v-form>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="$emit('update:modelValue', false)"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          :loading="creating"
          :disabled="!valid"
          @click="save"
        >
          Create
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Mapping } from '@/views/MappingStudio/Composables/types'

// Props
interface Props {
  modelValue: boolean
  mapping: Partial<Mapping>
  creating: boolean
}

defineProps<Props>()

// Emits
const emit = defineEmits(['update:modelValue', 'save'])

// Reactive data
const valid = ref(false)
const form = ref()
const localMapping = ref({
  name: '',
  description: '',
  type: '',
  sourceType: ''
})

// Watch for changes to the mapping prop
watch(() => localMapping.value, (newVal) => {
  localMapping.value = { ...newVal }
}, { deep: true })

// Mapping types
const mappingTypes = [
  { title: 'File Metadata', value: 'file-metadata' },
  { title: 'User Directory', value: 'user-directory' },
  { title: 'Project Structure', value: 'project-structure' },
  { title: 'Asset Metadata', value: 'asset-metadata' }
]

// Source types
const sourceTypes = [
  { title: 'Dropbox', value: 'dropbox' },
  { title: 'Google Drive', value: 'google-drive' },
  { title: 'S3 Bucket', value: 's3' }
]

// Methods
function save() {
  if (form.value.validate()) {
    emit('save', localMapping.value)
  }
}
</script>

<style scoped>
/* Scoped styles for this component */
</style>
