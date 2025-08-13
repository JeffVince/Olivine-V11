import { availableIntegrations } from './state'
import type { AvailableIntegration } from './Interface'

// Utility functions
export function getIntegrationColor(type: string): string {
  const integration = availableIntegrations.value.find((i: AvailableIntegration) => i.type === type)
  return integration ? integration.color : '#666'
}

export function getIntegrationIcon(type: string): string {
  const integration = availableIntegrations.value.find((i: AvailableIntegration) => i.type === type)
  return integration ? integration.icon : 'mdi-help'
}

export function getLogLevelColor(level: string): string {
  switch (level) {
    case 'error': return 'error'
    case 'warn': return 'warning'
    case 'warning': return 'warning'
    case 'success': return 'success'
    case 'info': return 'info'
    default: return 'default'
  }
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString()
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

// Helper function to show notifications
export function notify(level: 'info' | 'success' | 'error' | 'warn', message: string) {
  // In a real app, this would integrate with a notification system
  console.log(`[${level.toUpperCase()}] ${message}`)
}

// Helper functions for common notification types
export function showError(message: string) { notify('error', message) }
export function showSuccess(message: string) { notify('success', message) }
export function showInfo(message: string) { notify('info', message) }
export function showWarning(message: string) { notify('warn', message) }
