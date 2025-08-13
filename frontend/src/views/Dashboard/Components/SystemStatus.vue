<template>
  <v-card variant="outlined" class="glass-card">
    <v-card-title>System Status</v-card-title>
    <v-card-text>
      <v-chip
        color="success"
        class="mr-2"
      >
        <v-icon left>
          mdi-check
        </v-icon>
        Frontend Connected
      </v-chip>
      <v-chip color="success">
        <v-icon left>
          mdi-check
        </v-icon>
        Backend Online
      </v-chip>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
// System status component for the Dashboard view
</script>

<style scoped>
/* Add scoped styles here if needed */
</style>
