<template>
  <div>
    <h2>Settings & Roles</h2>
    <v-tabs v-model="tab" density="compact">
      <v-tab value="team">Team</v-tab>
      <v-tab value="templates">Templates</v-tab>
      <v-tab value="branch">Branch Policy</v-tab>
      <v-tab value="defaults">Call-sheet Defaults</v-tab>
    </v-tabs>
    <v-window v-model="tab">
      <v-window-item value="team"><v-card-text>Team settings wired to API later.</v-card-text></v-window-item>
      <v-window-item value="templates"><v-card-text>Template management.</v-card-text></v-window-item>
      <v-window-item value="branch"><v-card-text>Branch rules.</v-card-text></v-window-item>
      <v-window-item value="defaults"><v-card-text>Defaults for call sheets.</v-card-text></v-window-item>
    </v-window>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const tab = ref('team')
</script>


