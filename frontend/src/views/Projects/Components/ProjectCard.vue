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
      {{ project.title }}
    </v-card-title>
    
    <v-card-text>
      <p class="text-subtitle-2 text-medium-emphasis mb-2">
        {{ project.metadata?.description }}
      </p>
      
      <v-chip
        :color="getStatusColor(project.status)"
        size="small"
        class="mr-2 mb-2"
      >
        {{ project.status }}
      </v-chip>
      
      <v-chip
        v-if="project.metadata?.integrations"
        v-for="integration in project.metadata.integrations"
        :key="integration.type"
        :color="getIntegrationColor(integration.type)"
        size="small"
        class="mr-2 mb-2"
      >
        <v-icon left small>
          {{ getIntegrationIcon(integration.type) }}
        </v-icon>
        {{ integration.type }}
      </v-chip>
    </v-card-text>
    
    <v-card-actions class="px-4 py-2">
      <v-spacer />
      <span class="text-caption text-medium-emphasis">
        Last updated: {{ formatDate(project.updatedAt as any) }}
      </span>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import type { Project } from '@/stores/projectStore'

// Define props
const props = defineProps<{ project: Project }>()

// Define emits
const emit = defineEmits(['open', 'edit', 'archive', 'delete'])

// Methods to emit events
const openProject = () => emit('open', props.project.id)
const editProject = () => emit('edit', props.project.id)
const archiveProject = () => emit('archive', props.project.id)
const deleteProject = () => emit('delete', props.project.id)

// These methods would typically be imported from composables
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    development: 'blue',
    pre_production: 'orange',
    production: 'red',
    post_production: 'purple',
    completed: 'green',
    cancelled: 'grey'
  }
  return colors[status] || 'grey'
}

const getIntegrationColor = (type: string) => {
  const colors: Record<string, string> = {
    dropbox: 'blue',
    googledrive: 'green',
    frameio: 'red'
  }
  return colors[type] || 'grey'
}

const getIntegrationIcon = (type: string) => {
  const icons: Record<string, string> = {
    dropbox: 'mdi-dropbox',
    googledrive: 'mdi-google-drive',
    frameio: 'mdi-video'
  }
  return icons[type] || 'mdi-cloud'
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString()
}
</script>

<style scoped>
.project-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
