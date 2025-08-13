<template>
  <v-row class="mb-4">
    <v-col
      cols="12"
      md="8"
    >
      <h1 class="text-h4 font-weight-bold">
        Integrations
      </h1>
      <p class="text-subtitle-1 text-medium-emphasis">
        Connect and manage external services for your project
      </p>
    </v-col>
    <v-col
      cols="12"
      md="4"
      class="text-right"
    >
      <v-btn 
        color="primary"
        prepend-icon="mdi-plus"
        class="liquid-button"
        @click="$emit('add-integration')"
      >
        Add Integration
      </v-btn>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
// Emits
const emit = defineEmits(['add-integration'])
</script>

<style scoped>
.liquid-button {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: scale(1.03);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
  }
}
</style>
