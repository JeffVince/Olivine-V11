<template>
  <v-app-bar app density="comfortable">
    <v-app-bar-nav-icon @click="$emit('toggle-drawer')" />
    <v-toolbar-title>Olivine</v-toolbar-title>
    <v-spacer />
    <slot name="actions" />
  </v-app-bar>
  
</template>

<script setup lang="ts">
// Minimal header component
</script>


