<template>
  <div>
    <h2>Shoot-Day Cockpit</h2>
    <v-row>
      <v-col
        cols="12"
        md="8"
      >
        <v-card title="Scenes" class="glass-card">
          <v-card-text>Scenes table will be wired to API.</v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="12"
        md="4"
      >
        <v-card title="Actions" class="glass-card">
          <v-btn
            color="primary"
            class="ma-4"
          >
            Generate Call Sheet
          </v-btn>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
// Await API endpoints for scenes, crew, hazards and generation
</script>


