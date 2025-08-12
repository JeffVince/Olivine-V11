import { defineStore } from 'pinia'

interface SourceConnection {
  id: string
  provider: 'dropbox' | 'gdrive' | string
  scope?: string
  status: 'connected' | 'stale' | 'error' | 'disconnected'
  lastSyncAt?: string
  errorMessage?: string
}

interface SourceState {
  connections: SourceConnection[]
  syncing: boolean
}

export const useSourceStore = defineStore('sources', {
  state: (): SourceState => ({
    connections: [],
    syncing: false,
  }),
  actions: {
    setConnections(conns: SourceConnection[]) {
      this.connections = conns
    },
    setSyncing(v: boolean) {
      this.syncing = v
    },
    clear() {
      this.connections = []
      this.syncing = false
    },
  },
})


