<template>
  <div class="home">
    <WelcomeCard />
  </div>
</template>

<script setup lang="ts">
import WelcomeCard from './Components/WelcomeCard.vue'
import { useHomeState } from './Composables/state'

const {  } = useHomeState() // state is not used in this component
</script>

<style scoped>
.home { padding: 20px; }
/* Scoped styles for the main orchestrator component */
</style>
