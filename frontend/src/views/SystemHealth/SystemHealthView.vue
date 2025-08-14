<template>
  <div>
    <h2>System Health</h2>
    <SystemHealthCard />
  </div>
</template>

<script setup lang="ts">
import SystemHealthCard from './Components/SystemHealthCard.vue'
// useSystemHealthState() is called for side effects only, no state is used in this component
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useSystemHealthState } from './Composables/state'
</script>

<style scoped>
/* Scoped styles for the main orchestrator component */
</style>
