<template>
  <div>
    <h2>System Health</h2>
    <SystemHealthCard />
  </div>
</template>

<script setup lang="ts">
import SystemHealthCard from './Components/SystemHealthCard.vue'
import { useSystemHealthState } from './Composables/state'

const {  } = useSystemHealthState() // state is not used in this component
</script>

<style scoped>
/* Scoped styles for the main orchestrator component */
</style>
