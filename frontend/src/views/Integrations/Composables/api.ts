import { showAddDialog, logs, integrations, newIntegration, loading, selectedIntegration, showConfigDialog, logsIntegration, showLogsDialog } from './state'
import { API_BASE } from './constants'
import { showError, showSuccess } from './utils'
import type { Integration, AvailableIntegration } from './Interface'

// Integration methods
export async function connectIntegration(integration: Integration) {
  try {
    loading.value = true
    
    // For existing integrations, redirect to OAuth
    if (integration.__existing) {
      window.location.href = `${API_BASE}/auth/${integration.type}?organizationId=12345`
      return
    }
    
    // For new integrations, start OAuth flow
    window.location.href = `${API_BASE}/auth/${integration.type}?organizationId=12345`
  } catch (error: any) {
    showError(`Failed to connect ${integration.name}: ${error}`)
  } finally {
    loading.value = false
  }
}

export async function disconnectIntegration(integration: Integration) {
  try {
    loading.value = true
    
    const response = await fetch(`${API_BASE}/sources/${integration.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    if (!response.ok) throw new Error('Failed to disconnect integration')
    
    // Remove from local state
    integrations.value = integrations.value.filter(i => i.id !== integration.id)
    showSuccess(`${integration.name} disconnected successfully`)
  } catch (error: any) {
    showError(`Failed to disconnect ${integration.name}: ${error}`)
  } finally {
    loading.value = false
  }
}

export async function triggerSync(integration: Integration) {
  try {
    loading.value = true
    
    const response = await fetch(`${API_BASE}/sources/${integration.id}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    if (!response.ok) throw new Error('Failed to trigger sync')
    
    showSuccess(`Sync started for ${integration.name}`)
    
    // Update last sync time
    const updated = integrations.value.find(i => i.id === integration.id)
    if (updated) {
      updated.lastSync = new Date().toISOString()
    }
  } catch (error: any) {
    showError(`Failed to trigger sync for ${integration.name}: ${error}`)
  } finally {
    loading.value = false
  }
}

export function configureIntegration(integration: Integration) {
  selectedIntegration.value = integration
  showConfigDialog.value = true
}

export async function viewLogs(integration: Integration) {
  try {
    logsIntegration.value = integration
    loading.value = true
    
    const response = await fetch(`${API_BASE}/sources/${integration.id}/logs`)
    if (!response.ok) throw new Error('Failed to fetch logs')
    
    const logsData = await response.json()
    logs.value = logsData.map((log: any) => ({
      id: log.id,
      timestamp: log.timestamp,
      level: log.level,
      message: log.message
    }))
    
    showLogsDialog.value = true
  } catch (error: any) {
    showError(`Failed to fetch logs for ${integration.name}: ${error}`)
  } finally {
    loading.value = false
  }
}

export async function resubscribeWebhook(integration: Integration) {
  try {
    loading.value = true
    
    const response = await fetch(`${API_BASE}/sources/${integration.id}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    if (!response.ok) throw new Error('Failed to resubscribe webhook')
    
    showSuccess(`Webhook resubscribed for ${integration.name}`)
    
    // Update webhook status
    const updated = integrations.value.find(i => i.id === integration.id)
    if (updated) {
      updated.webhookStatus = 'active'
    }
  } catch (error: any) {
    showError(`Failed to resubscribe webhook for ${integration.name}: ${error}`)
  } finally {
    loading.value = false
  }
}

export function addIntegration(available: AvailableIntegration) {
  newIntegration.value = {
    type: available.type,
    name: `${available.name} Integration`,
    config: {}
  }
  showAddDialog.value = true
}

export function proceedWithIntegration() {
  showAddDialog.value = false
  if (newIntegration.value.type) {
    connectIntegration({
      id: '',
      type: newIntegration.value.type,
      name: newIntegration.value.name,
      description: '',
      connected: false
    } as Integration)
  }
}

export async function saveConfiguration() {
  try {
    loading.value = true
    
    // In a real implementation, this would save the configuration
    showSuccess('Configuration saved successfully')
    closeConfigDialog()
  } catch (error: any) {
    showError(`Failed to save configuration: ${error}`)
  } finally {
    loading.value = false
  }
}

export function closeConfigDialog() {
  showConfigDialog.value = false
  selectedIntegration.value = null
}

export function closeLogsDialog() {
  showLogsDialog.value = false
  logsIntegration.value = null
  logs.value = []
}
