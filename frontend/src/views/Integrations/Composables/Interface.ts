// Type definitions
export interface Integration {
  id: string
  type: string
  name: string
  description?: string
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
  active: boolean
  updatedAt: string
  config?: any
}

// GraphQL Types
export type Maybe<T> = T | null

// Input interfaces not needed on frontend since backend expects separate args

// GraphQL Result Types
export interface GetSourcesResult {
  getSources: IntegrationBase[]
}

export interface CreateSourceResult {
  createSource: IntegrationBase
}

export interface TriggerSyncResult {
  triggerSourceResync: boolean
}