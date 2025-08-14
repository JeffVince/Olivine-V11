<template>
  <div>
    <h2>Shoot-Day Cockpit</h2>
    <v-row>
      <v-col
        cols="12"
        md="8"
      >
        <ScenesTable />
      </v-col>
      <v-col
        cols="12"
        md="4"
      >
        <ActionsCard />
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import ScenesTable from './Components/ScenesTable.vue'
import ActionsCard from './Components/ActionsCard.vue'
// useShootDayCockpitState() is called for side effects only, no state is used in this component
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useShootDayCockpitState } from './Composables/state'
</script>

<style scoped>
/* Scoped styles for the main orchestrator component */
</style>
