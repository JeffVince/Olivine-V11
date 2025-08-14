<template>
  <div>
    <!-- Header -->
    <IntegrationsHeader @add-integration="showAddDialog = true" />

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
      v-model:selected-integration-root-folder="selectedIntegrationRootFolder"
      v-model:selected-integration-enable-webhooks="selectedIntegrationEnableWebhooks"
      :selected-integration="selectedIntegration"
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
  connectIntegration,
  disconnectIntegration,
  triggerSync,
  configureIntegration,
  viewLogs,
  addIntegration,
  proceedWithIntegration,
  saveConfiguration,
  closeConfigDialog,
  closeLogsDialog
} from '@/views/Integrations/Composables'

// Import Apollo Client composable
import { useSourcesQuery } from '@/views/Integrations/Composables/graphql'
import { updateIntegrationsFromResult } from '@/views/Integrations/Composables/state'
import { useRoute } from 'vue-router'
import { watch } from 'vue'

// Get organization ID from route
const route = useRoute()
const projectId = route.params.id as string

// Use the GraphQL query within component context
const { result, loading: queryLoading, error } = useSourcesQuery(projectId)

// Watch for changes in the query result and update integrations
watch(result, (newResult: any) => {
  updateIntegrationsFromResult(newResult)
})

// Watch for query errors
watch(error, (newError: any) => {
  if (newError) {
    console.error('GraphQL Error:', newError)
  }
})

// Import new components
import IntegrationsHeader from '@/views/Integrations/Components/IntegrationsHeader.vue'
import IntegrationCard from '@/views/Integrations/Components/IntegrationCard.vue'
import AvailableIntegrations from '@/views/Integrations/Components/AvailableIntegrations.vue'
import AddIntegrationDialog from '@/views/Integrations/Components/AddIntegrationDialog.vue'
import ConfigureIntegrationDialog from '@/views/Integrations/Components/ConfigureIntegrationDialog.vue'
import LogsDialog from '@/views/Integrations/Components/LogsDialog.vue'
</script>
