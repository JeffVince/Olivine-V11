import type { Ref, ComputedRef } from 'vue'
import type { Integration, AvailableIntegration, LogEntry } from './Interface'

export interface IntegrationComposables {
  // State refs
  showAddDialog: Ref<boolean>
  showConfigDialog: Ref<boolean>
  showLogsDialog: Ref<boolean>
  selectedIntegration: Ref<Integration | null>
  logsIntegration: Ref<Integration | null>
  logs: Ref<LogEntry[]>
  integrations: Ref<Integration[]>
  search: Ref<string>
  loading: Ref<boolean>
  newIntegration: Ref<{
    type: string
    name: string
    config: any
  }>
  
  // Computed properties
  selectedIntegrationRootFolder: ComputedRef<string>
  selectedIntegrationEnableWebhooks: ComputedRef<boolean>
  availableIntegrations: Ref<AvailableIntegration[]>
  filteredIntegrations: ComputedRef<Integration[]>
  
  // Functions
  connectIntegration: (integration: Integration) => Promise<void>
  disconnectIntegration: (integrationId: string) => Promise<void>
  triggerSync: (integrationId: string) => Promise<void>
  configureIntegration: (integration: Integration) => void
  viewLogs: (integration: Integration) => void
  addIntegration: () => void
  proceedWithIntegration: () => Promise<void>
  saveConfiguration: () => Promise<void>
  closeConfigDialog: () => void
  closeLogsDialog: () => void
  updateIntegrationsFromResult: (result: any) => void
}
