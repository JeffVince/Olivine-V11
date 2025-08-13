import { integrations } from './state'
import type { GetSourcesResult } from './Interface'

let result: { value: GetSourcesResult | null } = { value: null }

export function updateFromResult() {
  if (!result.value?.getSources) return
  integrations.value = result.value.getSources.map((s: any) => ({
    id: s.id,
    type: s.type === 'google_drive' ? 'googledrive' : s.type,
    name: s.name,
    description: s.type === 'dropbox' ? 'Dropbox storage' : s.type === 'google_drive' ? 'Google Drive storage' : s.type,
    connected: s.active,
    lastSync: s.updatedAt,
    rootFolder: s.config?.rootFolder,
    webhookStatus: s.config?.enableWebhooks ? 'active' : 'inactive',
    stats: undefined,
    __existing: true,
  }))
}
