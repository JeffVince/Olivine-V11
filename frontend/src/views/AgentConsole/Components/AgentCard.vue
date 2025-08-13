<template>
  <v-card 
    class="agent-card"
    :class="{ 'active': agent.status === 'active' }"
    variant="outlined"
  >
    <v-card-title class="d-flex align-center">
      <v-avatar 
        :color="getAgentColor(agent.type)"
        class="mr-3"
        size="40"
      >
        <v-icon :icon="getAgentIcon(agent.type)" />
      </v-avatar>
      <div class="flex-grow-1">
        <div class="text-subtitle-1">
          {{ agent.name }}
        </div>
        <v-chip 
          :color="getStatusColor(agent.status)"
          size="x-small"
          variant="tonal"
        >
          {{ agent.status }}
        </v-chip>
      </div>
      <v-menu>
        <template #activator="{ props }">
          <v-btn 
            v-bind="props"
            icon="mdi-dots-vertical"
            variant="text"
            size="small"
          />
        </template>
        <v-list>
          <v-list-item @click="viewAgent(agent)">
            <v-list-item-title>
              <v-icon start>
                mdi-eye
              </v-icon>
              View Details
            </v-list-item-title>
          </v-list-item>
          <v-list-item @click="editAgent(agent)">
            <v-list-item-title>
              <v-icon start>
                mdi-pencil
              </v-icon>
              Edit
            </v-list-item-title>
          </v-list-item>
          <v-list-item @click="duplicateAgent(agent)">
            <v-list-item-title>
              <v-icon start>
                mdi-content-copy
              </v-icon>
              Duplicate
            </v-list-item-title>
          </v-list-item>
          <v-divider />
          <v-list-item
            class="text-error"
            @click="deleteAgent(agent)"
          >
            <v-list-item-title>
              <v-icon start>
                mdi-delete
              </v-icon>
              Delete
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-card-title>

    <v-card-text>
      <p class="text-body-2 mb-3">
        {{ agent.description }}
      </p>
      
      <!-- Agent Stats -->
      <v-row class="text-center mb-3">
        <v-col cols="4">
          <div class="text-h6">
            {{ agent.tasksCompleted }}
          </div>
          <div class="text-caption text-medium-emphasis">
            Completed
          </div>
        </v-col>
        <v-col cols="4">
          <div class="text-h6">
            {{ agent.tasksRunning }}
          </div>
          <div class="text-caption text-medium-emphasis">
            Running
          </div>
        </v-col>
        <v-col cols="4">
          <div class="text-h6">
            {{ agent.uptime }}
          </div>
          <div class="text-caption text-medium-emphasis">
            Uptime
          </div>
        </v-col>
      </v-row>

      <!-- Last Activity -->
      <div
        v-if="agent.lastActivity"
        class="text-caption text-medium-emphasis"
      >
        Last activity: {{ formatDateTime(agent.lastActivity) }}
      </div>
    </v-card-text>

    <v-card-actions>
      <v-btn 
        :color="agent.status === 'active' ? 'warning' : 'success'"
        variant="outlined"
        size="small"
        :loading="toggling === agent.id"
        @click="toggleAgentStatus(agent)"
      >
        {{ agent.status === 'active' ? 'Stop' : 'Start' }}
      </v-btn>
      <v-spacer />
      <v-btn 
        color="primary"
        variant="flat"
        size="small"
        @click="viewAgent(agent)"
      >
        View Details
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { Agent } from '../Composables/Interface'

interface Props {
  agent: Agent
  toggling: string | null
}

defineProps<Props>()

defineEmits(['view', 'edit', 'duplicate', 'delete', 'toggle'])

function getAgentColor(type: string) {
  switch (type) {
    case 'file-processor': return 'blue'
    case 'data-sync': return 'green'
    case 'notification': return 'orange'
    case 'backup': return 'purple'
    case 'analytics': return 'teal'
    default: return 'grey'
  }
}

function getAgentIcon(type: string) {
  switch (type) {
    case 'file-processor': return 'mdi-file-cog'
    case 'data-sync': return 'mdi-sync'
    case 'notification': return 'mdi-bell'
    case 'backup': return 'mdi-backup-restore'
    case 'analytics': return 'mdi-chart-line'
    default: return 'mdi-robot'
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active': return 'success'
    case 'inactive': return 'grey'
    case 'error': return 'error'
    case 'paused': return 'warning'
    default: return 'grey'
  }
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

function viewAgent(agent: Agent) {
  // Emit event to parent
  // Implementation will be handled by parent component
}

function editAgent(agent: Agent) {
  // Emit event to parent
  // Implementation will be handled by parent component
}

function duplicateAgent(agent: Agent) {
  // Emit event to parent
  // Implementation will be handled by parent component
}

function deleteAgent(agent: Agent) {
  // Emit event to parent
  // Implementation will be handled by parent component
}

function toggleAgentStatus(agent: Agent) {
  // Emit event to parent
  // Implementation will be handled by parent component
}
</script>

<style scoped>
.agent-card {
  transition: all 0.3s ease;
}

.agent-card.active {
  border-left: 4px solid rgb(var(--v-theme-success));
}
</style>
