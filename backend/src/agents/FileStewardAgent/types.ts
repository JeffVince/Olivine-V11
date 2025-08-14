export interface SyncJobData {
  orgId: string
  sourceId: string
  eventType: 'file_created' | 'file_updated' | 'file_deleted' | 'folder_created' | 'folder_updated' | 'folder_deleted'
  resourcePath: string
  eventData: any
}

export interface ClusterProcessingResult {
  fileId: string
  clusterId: string
  slots: string[]
  extractionTriggered: boolean
  crossLayerLinksCreated: number
}

export interface FileMetadata {
  name: string
  size: number
  mimeType: string
  checksum?: string
  modified: string
  dbId: string
  provider: 'dropbox' | 'gdrive' | 'supabase'
  extra: any
}


