<template>
  <div class="home">
    <WelcomeCard />
  </div>
</template>

<script setup lang="ts">
import WelcomeCard from './Components/WelcomeCard.vue'
// useHomeState() is called for side effects only, no state is used in this component
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useHomeState } from './Composables/state'
</script>

<style scoped>
.home { padding: 20px; }
/* Scoped styles for the main orchestrator component */
</style>
