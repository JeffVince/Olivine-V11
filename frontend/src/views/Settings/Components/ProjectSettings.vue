<template>
  <v-form
    ref="projectForm"
    @submit.prevent="saveProject"
  >
    <v-card class="glass-card pa-4 mb-4">
      <v-text-field
        v-model="localProjectOptions.name"
        label="Project Name"
        :rules="nameRules"
        required
      />
      <v-combobox
        v-model="localProjectOptions.templates"
        label="Templates"
        multiple
        chips
        hide-selected
      />
      <v-switch
        v-model="localProjectOptions.autoApprove"
        label="Auto-approve tasks"
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
import type { ProjectOptions } from '../Composables/Interface'

// Props
const props = defineProps<{
  projectOptions: ProjectOptions
  nameRules: Array<(v: string) => boolean | string>
}>()

// Emits
const emit = defineEmits(['update:projectOptions', 'save'])

// Create a local copy of the prop
const localProjectOptions = ref<ProjectOptions>({ ...props.projectOptions })

// Form reference
const projectForm = ref()

// Methods
async function saveProject() {
  const { valid } = await projectForm.value.validate()
  if (!valid) return
  emit('save', localProjectOptions.value)
  emit('update:projectOptions', localProjectOptions.value)
}

// Watch for prop changes and update local copy
watch(() => props.projectOptions, () => {
  localProjectOptions.value = { ...props.projectOptions }
})
</script>

<style scoped>
/* Scoped styles for this component */
</style>
