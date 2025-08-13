export interface FileItem {
  id: string
  name: string
  path: string
  size?: number
  mimeType?: string
  updatedAt: string
  current?: boolean
  deleted?: boolean
  orgId?: string
  classificationStatus?: string
  classificationConfidence?: number
  canonicalSlot?: string
  metadata?: Record<string, any>
  extractedText?: string
  project?: {
    id: string
    name: string
  }
  source?: {
    id: string
    name: string
  }
}

export interface FolderItem {
  id: string
  name: string
  type: 'folder' | 'file'
  children?: FolderItem[]
  fileCount?: number
  hasIssues?: boolean
}

export interface FileExplorerState {
  viewMode: 'source' | 'entity'
  fileViewMode: 'table' | 'grid' | 'list'
  searchQuery: string
  selectedFolders: string[]
  openedFolders: string[]
  selectedFiles: FileItem[]
  selectedFile: FileItem | null
  selectedFilters: string[]
  syncStatus: 'idle' | 'syncing' | 'error'
  showUploadDialog: boolean
  currentProvider: string
  actionLoading: boolean
  showClassify: boolean
  entityGroupBy: 'project' | 'source'
}

export interface ClassificationOption {
  value: string
  label: string
}

export interface MimeOption {
  value: string
  label: string
}
