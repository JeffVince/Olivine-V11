<template>
  <div>
    <!-- Header -->
    <Header @add-integration="showAddDialog = true" />

    <!-- Integration Cards -->
    <v-row>
      <v-col 
        v-for="integration in filteredIntegrations"
        :key="integration.id"
        cols="12"
        md="6"
        lg="4"
      >
        <IntegrationCard 
          :integration="integration" 
          :loading="loading"
          @connect="connectIntegration"
          @sync="triggerSync"
          @configure="configureIntegration"
          @view-logs="viewLogs"
          @disconnect="disconnectIntegration"
        />
      </v-col>
    </v-row>

    <!-- Available Integrations -->
    <AvailableIntegrations 
      :available-integrations="availableIntegrations" 
      @add="addIntegration"
    />

    <!-- Add Integration Dialog -->
    <AddIntegrationDialog
      v-model="showAddDialog"
      :new-integration="newIntegration"
      @cancel="showAddDialog = false"
      @proceed="proceedWithIntegration"
    />

    <!-- Configuration Dialog -->
    <ConfigureIntegrationDialog
      v-model="showConfigDialog"
      :selected-integration="selectedIntegration"
      v-model:selected-integration-root-folder="selectedIntegrationRootFolder"
      v-model:selected-integration-enable-webhooks="selectedIntegrationEnableWebhooks"
      @close="closeConfigDialog"
      @save="saveConfiguration"
    />

    <!-- Logs Dialog -->
    <LogsDialog
      v-model="showLogsDialog"
      :logs-integration="logsIntegration"
      :logs="logs"
      @close="closeLogsDialog"
    />
  </div>
</template>

<script setup lang="ts">
import {
  showAddDialog,
  showConfigDialog,
  showLogsDialog,
  selectedIntegration,
  logsIntegration,
  logs,
  filteredIntegrations,
  availableIntegrations,
  newIntegration,
  loading,
  selectedIntegrationRootFolder,
  selectedIntegrationEnableWebhooks,
  getIntegrationColor,
  getIntegrationIcon,
  getLogLevelColor,
  formatDate,
  formatDateTime,
  connectIntegration,
  disconnectIntegration,
  triggerSync,
  configureIntegration,
  viewLogs,
  addIntegration,
  proceedWithIntegration,
  saveConfiguration,
  closeConfigDialog,
  closeLogsDialog,
  notify,
  showError,
  showSuccess,
  showInfo,
  showWarning
} from '@/views/Integrations/Composables'

// Import new components
import Header from '@/views/Integrations/Components/Header.vue'
import IntegrationCard from '@/views/Integrations/Components/IntegrationCard.vue'
import AvailableIntegrations from '@/views/Integrations/Components/AvailableIntegrations.vue'
import AddIntegrationDialog from '@/views/Integrations/Components/AddIntegrationDialog.vue'
import ConfigureIntegrationDialog from '@/views/Integrations/Components/ConfigureIntegrationDialog.vue'
import LogsDialog from '@/views/Integrations/Components/LogsDialog.vue'
</script>
