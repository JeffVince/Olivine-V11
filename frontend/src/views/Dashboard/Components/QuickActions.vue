<template>
  <v-card variant="outlined" class="glass-card">
    <v-card-title>Quick Actions</v-card-title>
    <v-card-text>
      <v-btn 
        color="primary" 
        class="mr-2 mb-2"
        @click="navigateToFileExplorer"
      >
        <v-icon left>
          mdi-folder
        </v-icon>
        File Explorer
      </v-btn>
      <v-btn 
        color="secondary" 
        class="mr-2 mb-2"
        @click="navigateToIntegrations"
      >
        <v-icon left>
          mdi-puzzle
        </v-icon>
        Integrations
      </v-btn>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'

const router = useRouter()
const projectStore = useProjectStore()

const navigateToFileExplorer = () => {
  console.log('Navigating to File Explorer')
  if (projectStore.currentProjectId) {
    router.push(`/projects/${projectStore.currentProjectId}/files`)
  } else {
    router.push('/projects')
  }
}

const navigateToIntegrations = () => {
  console.log('Navigating to Integrations')
  if (projectStore.currentProjectId) {
    router.push(`/projects/${projectStore.currentProjectId}/integrations`)
  } else {
    router.push('/projects')
  }
}
</script>

<style scoped>
/* Add scoped styles here if needed */
</style>
