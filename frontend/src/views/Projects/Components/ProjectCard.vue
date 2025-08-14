<template>
  <v-card 
    class="project-card glass-card" 
    hover
    @click="openProject"
  >
    <v-card-title class="d-flex align-center">
      <v-icon
        class="mr-2"
        color="primary"
      >
        mdi-folder-star
      </v-icon>
      {{ project.name }}
    </v-card-title>
    
    <v-card-text>
      <p class="text-subtitle-2 text-medium-emphasis mb-2">
        {{ project.description }}
      </p>
      
      <v-chip
        :color="getStatusColor(project.status)"
        size="small"
        class="mr-2 mb-2"
      >
        {{ project.status }}
      </v-chip>
      
      <v-chip
        v-for="(integration, index) in project.integrations"
        :key="index"
        :color="getIntegrationColor(integration.type)"
        size="small"
        class="mr-2 mb-2"
      >
        <v-icon
          left
          size="small"
        >
          {{ getIntegrationIcon(integration.type) }}
        </v-icon>
        {{ integration.type }}
      </v-chip>
      
      <div
        v-if="project.created_at"
        class="text-caption text-medium-emphasis mt-3"
      >
        Created: {{ formatDate(project.created_at) }}
      </div>
      <div
        v-if="project.updated_at"
        class="text-caption text-medium-emphasis"
      >
        Updated: {{ formatDate(project.updated_at) }}
      </div>
    </v-card-text>
    
    <v-card-actions>
      <v-btn 
        color="primary" 
        variant="text" 
        size="small"
        @click.stop="editProject"
      >
        Edit
      </v-btn>
      <v-btn 
        color="warning" 
        variant="text" 
        size="small"
        @click.stop="archiveProject"
      >
        Archive
      </v-btn>
      <v-btn 
        color="error" 
        variant="text" 
        size="small"
        @click.stop="deleteProject"
      >
        Delete
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import type { Project } from '../Composables/Interface'

// Define props
const props = defineProps<{
  project: Project
}>()

// Define emits
const emit = defineEmits(['open', 'edit', 'archive', 'delete'])

// Methods to emit events
const openProject = () => {
  emit('open', props.project.id)
}

const editProject = () => {
  emit('edit', props.project)
}

const archiveProject = () => {
  emit('archive', props.project)
}

const deleteProject = () => {
  emit('delete', props.project)
}

// These methods would typically be imported from composables
const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'success'
    case 'archived': return 'warning'
    case 'deleted': return 'error'
    default: return 'grey'
  }
}

const getIntegrationColor = (type: string) => {
  switch (type) {
    case 'dropbox': return '#0061FF'
    case 'frameio': return '#FF6B00'
    case 'shotgrid': return '#FF0000'
    default: return 'primary'
  }
}

const getIntegrationIcon = (type: string) => {
  switch (type) {
    case 'dropbox': return 'mdi-dropbox'
    case 'frameio': return 'mdi-video'
    case 'shotgrid': return 'mdi-database'
    default: return 'mdi-folder'
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}
</script>

<style scoped>
.project-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.project-card:hover {
  transform: translateY(-2px);
}
</style>
