<template>
  <v-row class="mb-4">
    <v-col
      cols="12"
      md="8"
    >
      <h1 class="text-h4 font-weight-bold">
        Mapping Studio
      </h1>
      <p class="text-subtitle-1 text-medium-emphasis">
        Configure data transformations and field mappings
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
        @click="$emit('create-mapping')"
      >
        Create Mapping
      </v-btn>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
// Emits
const emit = defineEmits(['create-mapping'])
</script>

<style scoped>
/* Scoped styles for this component */
</style>
