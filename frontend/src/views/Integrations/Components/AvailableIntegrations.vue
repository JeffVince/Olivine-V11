<template>
  <v-card class="mt-6 glass-card">
    <v-card-title>
      Available Integrations
    </v-card-title>
    <v-card-text>
      <v-row>
        <v-col 
          v-for="integration in availableIntegrations"
          :key="integration.id"
          cols="12"
          md="6"
          lg="4"
        >
          <v-list>
            <v-list-item>
              <template #prepend>
                <v-avatar
                  :color="integration.color"
                  size="40"
                >
                  <v-icon :icon="integration.icon" />
                </v-avatar>
              </template>
              <v-list-item-title>{{ integration.name }}</v-list-item-title>
              <v-list-item-subtitle>{{ integration.description }}</v-list-item-subtitle>
              <template #append>
                <v-btn 
                  color="primary"
                  variant="outlined"
                  size="small"
                  @click="$emit('add', integration)"
                >
                  Add
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { AvailableIntegration } from '@/views/Integrations/Composables/Interface'

// Props
const props = defineProps<{
  availableIntegrations: AvailableIntegration[]
}>()

// Emits
const emit = defineEmits(['add'])
</script>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.7) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
</style>
