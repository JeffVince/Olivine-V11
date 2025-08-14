<template>
  <div class="dashboard-header">
    <v-row class="align-center mb-6">
      <v-col
        cols="12"
        md="8"
      >
        <h1 class="text-h3 font-weight-bold">
          Dashboard
        </h1>
        <p class="text-subtitle-1 text-medium-emphasis">
          Welcome back! Here's what's happening with your projects today.
        </p>
      </v-col>
      <v-col
        cols="12"
        md="4"
        class="text-md-right"
      >
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          class="liquid-button"
          @click="createProject"
        >
          New Project
        </v-btn>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { useNotificationStore } from '@/stores/notificationStore'

const notificationStore = useNotificationStore()

// projectStore is imported but not used in this component
// const projectStore = useProjectStore()

defineEmits(['createProject'])

function createProject() {
  // This would open the create project dialog
  console.log('Create project clicked')
  notificationStore.add('info', 'Create project functionality would be implemented here')
}
</script>

<style scoped>
/* Add scoped styles here if needed */
</style>
