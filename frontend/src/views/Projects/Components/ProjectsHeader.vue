<template>
  <v-row class="mb-4">
    <v-col
      cols="12"
      md="8"
    >
      <h1 class="text-h4 font-weight-bold">
        Projects
      </h1>
      <p class="text-subtitle-1 text-medium-emphasis">
        Manage your production projects and connect storage sources
      </p>
    </v-col>
    <v-col
      cols="12"
      md="4"
      class="text-right"
    >
      <v-btn 
        color="primary" 
        size="large"
        prepend-icon="mdi-plus"
        class="liquid-button"
        @click="showCreateDialog"
      >
        New Project
      </v-btn>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
// Define emit for showing create dialog
const emit = defineEmits(['show-create-dialog'])

// Method to emit event when button is clicked
const showCreateDialog = () => {
  emit('show-create-dialog')
}
</script>

<style scoped>
/* Add scoped styles here if needed */
</style>
