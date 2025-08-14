<template>
  <v-app-bar
    app
    density="comfortable"
    class="glass glass-header"
    elevation="0"
  >
    <v-app-bar-nav-icon
      class="liquid-button"
      @click="$emit('toggle-drawer')"
    />
    <v-toolbar-title class="accent-olivine">
      Olivine
    </v-toolbar-title>
    <v-spacer />
    <slot name="actions" />
  </v-app-bar>
</template>

<script setup lang="ts">
// Minimal header component

defineEmits(['toggle-drawer'])
</script>


