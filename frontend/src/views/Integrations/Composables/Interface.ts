// Type definitions
export interface Integration {
  id: string
  type: string
  name: string
  description: string
  connected: boolean
  lastSync?: string
  rootFolder?: string
  webhookStatus?: string
  stats?: {
    files: number
    folders: number
    size: string
  }
  __existing?: boolean
  config?: {
    enableWebhooks?: boolean
    rootFolder?: string
    notifications?: boolean
    syncFrequency?: string
    [key: string]: any
  }
  active?: boolean
  updatedAt?: string
}

export interface AvailableIntegration {
  id: string
  type: string
  name: string
  description: string
  icon: string
  color: string
}

export interface NewIntegration {
  name: string
  type?: string
  description?: string
}

export interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'success' | 'warning'
  message: string
}

// Types
export type NotificationLevel = 'info' | 'success' | 'error' | 'warn'

export interface IntegrationBase {
  id: string
  type: string
  name: string
  description: string
  active: boolean
  updatedAt: string
  config?: {
    rootFolder?: string
    enableWebhooks?: boolean
    notifications?: boolean
    syncFrequency?: string
    [key: string]: any
  }
}

// GraphQL Types
export type Maybe<T> = T | null

export interface CreateSourceInput {
  organizationId: string
  type: string
  name: string
  config?: any
}

export interface TriggerSyncInput {
  sourceId: string
}

// GraphQL Result Types
export interface GetSourcesResult {
  getSources: IntegrationBase[]
}

export interface CreateSourceResult {
  createSource: IntegrationBase
}

export interface TriggerSyncResult {
  triggerSync: {
    success: boolean
    message: string
  }
}