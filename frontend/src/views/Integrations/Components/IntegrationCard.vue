<template>
  <v-card 
    class="integration-card glass-card"
    :class="{ 'connected': integration.connected }"
  >
    <v-card-title class="d-flex align-center">
      <v-avatar 
        :color="getIntegrationColor(integration.type)"
        class="mr-3"
        size="40"
      >
        <v-icon :icon="getIntegrationIcon(integration.type)" />
      </v-avatar>
      <div>
        <div class="text-h6">
          {{ integration.name }}
        </div>
        <v-chip 
          :color="integration.connected ? 'success' : 'warning'"
          size="small"
          variant="tonal"
        >
          {{ integration.connected ? 'Connected' : 'Disconnected' }}
        </v-chip>
      </div>
    </v-card-title>

    <v-card-text>
      <!-- Description would go here if available -->
      
      <!-- Connection Status -->
      <div
        v-if="integration.connected"
        class="mb-3"
      >
        <v-list density="compact">
          <v-list-item v-if="integration.lastSync">
            <v-list-item-title>Last Sync</v-list-item-title>
            <v-list-item-subtitle>{{ formatDate(integration.lastSync) }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item v-if="integration.rootFolder">
            <v-list-item-title>Root Folder</v-list-item-title>
            <v-list-item-subtitle>{{ integration.rootFolder }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item v-if="integration.webhookStatus">
            <v-list-item-title>Webhook Status</v-list-item-title>
            <v-list-item-subtitle>
              <v-chip 
                :color="integration.webhookStatus === 'active' ? 'success' : 'warning'"
                size="x-small"
              >
                {{ integration.webhookStatus }}
              </v-chip>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </div>

      <!-- Statistics -->
      <div 
        v-if="integration.stats"
        class="integration-stats"
      >
        <div class="stat-card">
          <div class="stat-value">
            {{ integration.stats.files }}
          </div>
          <div class="stat-label">
            Files
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-value">
            {{ integration.stats.folders }}
          </div>
          <div class="stat-label">
            Folders
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-value">
            {{ integration.stats.size }}
          </div>
          <div class="stat-label">
            Size
          </div>
        </div>
      </div>
    </v-card-text>

    <v-card-actions>
      <v-btn 
        v-if="!integration.connected"
        color="primary"
        variant="flat"
        :loading="loading"
        @click="$emit('connect', integration)"
      >
        Connect
      </v-btn>
      <v-btn 
        v-else
        color="success"
        variant="outlined"
        :loading="loading"
        @click="$emit('sync', integration)"
      >
        Sync Now
      </v-btn>
      <v-btn 
        v-if="integration.connected"
        variant="text"
        @click="$emit('configure', integration)"
      >
        Configure
      </v-btn>
      <v-btn 
        v-if="integration.connected"
        variant="text"
        @click="$emit('view-logs', integration)"
      >
        Logs
      </v-btn>
      <v-btn 
        v-if="integration.connected"
        variant="text"
        color="error"
        @click="$emit('disconnect', integration)"
      >
        Disconnect
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import type { Integration } from '@/views/Integrations/Composables/Interface'
import { getIntegrationColor, getIntegrationIcon, formatDate } from '@/views/Integrations/Composables/utils'

// Props
defineProps<{
  integration: Integration
  loading: boolean
}>()

// Emits
defineEmits(['connect', 'sync', 'configure', 'view-logs', 'disconnect'])
</script>

<style scoped>
.integration-card {
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.12) !important;
  }
  
  &.connected {
    border-left: 4px solid #4caf50;
  }
}

.integration-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 16px;
  
  .stat-card {
    text-align: center;
    padding: 12px;
    
    .stat-value {
      font-size: 1.2rem;
      font-weight: 500;
    }
    
    .stat-label {
      font-size: 0.8rem;
      opacity: 0.7;
    }
  }
}

.glass-card {
  background: rgba(255, 255, 255, 0.7) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
</style>
