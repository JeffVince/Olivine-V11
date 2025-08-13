import { FileItem, ClassificationOption, MimeOption } from './Interface'

export function useFileExplorerUtils() {
  // File headers for table view (aligned to available data)
  const fileHeaders = [
    { title: 'Name', key: 'name', sortable: true },
    { title: 'MIME', key: 'mimeType', sortable: true },
    { title: 'Size', key: 'size', sortable: true },
    { title: 'Updated', key: 'updatedAt', sortable: true },
    { title: '', key: 'actions', sortable: false }
  ]
  
  // File filters
  const fileFilters = [
    { key: 'current', label: 'Current', icon: 'mdi-check-circle' },
    { key: 'deleted', label: 'Deleted', icon: 'mdi-delete' }
  ]
  
  // Backend-driven classification filter
  const classificationOptions: ClassificationOption[] = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'CLASSIFIED', label: 'Classified' },
    { value: 'MANUAL_REVIEW', label: 'Manual review' },
    { value: 'FAILED', label: 'Failed' },
  ]
  
  const mimeOptions: MimeOption[] = [
    { value: 'application/pdf', label: 'PDF' },
    { value: 'image/jpeg', label: 'JPEG' },
    { value: 'image/png', label: 'PNG' },
    { value: 'text/plain', label: 'Text' },
    { value: 'application/json', label: 'JSON' },
  ]
  
  // Utility functions
  function getProviderColor(provider: string) {
    switch (provider.toLowerCase()) {
      case 'dropbox': return 'blue'
      case 'googledrive': return 'green'
      default: return 'grey'
    }
  }
  
  function getProviderIcon(provider: string) {
    switch (provider.toLowerCase()) {
      case 'dropbox': return 'mdi-dropbox'
      case 'googledrive': return 'mdi-google-drive'
      default: return 'mdi-cloud'
    }
  }
  
  function formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }
  
  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString()
  }
  
  function classificationColor(status?: string) {
    switch ((status || '').toUpperCase()) {
      case 'CLASSIFIED':
        return 'green'
      case 'MANUAL_REVIEW':
        return 'orange'
      case 'FAILED':
        return 'red'
      default:
        return 'grey'
    }
  }
  
  function mimeIcon(mime?: string) {
    if (!mime) return 'mdi-file'
    if (mime.startsWith('image/')) return 'mdi-file-image'
    if (mime.startsWith('video/')) return 'mdi-file-video'
    if (mime.startsWith('audio/')) return 'mdi-file-music'
    if (mime === 'application/pdf') return 'mdi-file-pdf-box'
    if (mime.startsWith('text/')) return 'mdi-file-document'
    return 'mdi-file'
  }
  
  return {
    fileHeaders,
    fileFilters,
    classificationOptions,
    mimeOptions,
    getProviderColor,
    getProviderIcon,
    formatFileSize,
    formatDate,
    classificationColor,
    mimeIcon
  }
}
