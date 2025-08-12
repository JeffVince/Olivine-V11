import { defineStore } from 'pinia'

interface FileItemMeta {
  id: string
  name: string
  path: string
  size?: number
  modifiedAt?: string
  provider?: string
  slot?: string | null
  confidence?: number | null
}

interface FileState {
  items: FileItemMeta[]
  selectedIds: string[]
  loading: boolean
}

export const useFileStore = defineStore('files', {
  state: (): FileState => ({
    items: [],
    selectedIds: [],
    loading: false,
  }),
  getters: {
    selectedItems: (state) => state.items.filter(i => state.selectedIds.includes(i.id)),
  },
  actions: {
    setItems(items: FileItemMeta[]) {
      this.items = items
    },
    setSelected(ids: string[]) {
      this.selectedIds = ids
    },
    setLoading(v: boolean) {
      this.loading = v
    },
    clear() {
      this.items = []
      this.selectedIds = []
      this.loading = false
    },
  },
})


