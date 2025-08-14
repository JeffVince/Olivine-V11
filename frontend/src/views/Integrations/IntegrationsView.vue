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
// Import components first
import IntegrationsHeader from '@/views/Integrations/Components/IntegrationsHeader.vue'
import IntegrationCard from '@/views/Integrations/Components/IntegrationCard.vue'
import AvailableIntegrations from '@/views/Integrations/Components/AvailableIntegrations.vue'
import AddIntegrationDialog from '@/views/Integrations/Components/AddIntegrationDialog.vue'
import LogsDialog from '@/views/Integrations/Components/LogsDialog.vue'
import ConfigureIntegrationDialog from '@/views/Integrations/Components/ConfigDialog.vue'

// Import composables individually to ensure proper type inference
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
  integrations, 
  search, 
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
  updateIntegrationsFromResult 
} from '@/views/Integrations/Composables'

// Import Apollo Client composable
import { useSourcesQuery } from '@/views/Integrations/Composables/graphql'
import { useRoute } from 'vue-router'
import { useOrganizationStore } from '@/stores/organizationStore'
import { watch } from 'vue'

// Get organization ID from store
const organizationStore = useOrganizationStore()
// const projectId = route.params.id as string

// Use the GraphQL query within component context
// Use organization ID from store, fallback to a default for development
const organizationId = organizationStore.currentOrg?.id || '00000000-0000-0000-0000-000000000000'
const { result, error } = useSourcesQuery(organizationId)

// Watch for changes in the query result and update integrations
watch(result, (newResult: any) => {
  if (newResult) {
    updateIntegrationsFromResult(newResult)
  }
})

// Error handling is done in the composable

// Watch for query errors
// Error handling is done in the composable
</script>
