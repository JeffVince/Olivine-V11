<template>
  <v-form
    ref="projectForm"
    @submit.prevent="saveProject"
  >
    <v-card class="glass-card pa-4 mb-4">
      <v-text-field
        v-model="projectOptions.name"
        label="Project Name"
        :rules="nameRules"
        required
      />
      <v-combobox
        v-model="projectOptions.templates"
        label="Templates"
        multiple
        chips
        hide-selected
      />
      <v-switch
        v-model="projectOptions.autoApprove"
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
import { ref } from 'vue'
import type { ProjectOptions } from '../Composables/Interface'

// Props
const props = defineProps<{
  projectOptions: ProjectOptions
  nameRules: Array<(v: string) => boolean | string>
}>()

// Emits
const emit = defineEmits(['save'])

// Form reference
const projectForm = ref()

// Methods
async function saveProject() {
  const { valid } = await projectForm.value.validate()
  if (!valid) return
  emit('save', props.projectOptions)
}
</script>

<style scoped>
/* Scoped styles for this component */
</style>
