import { computed, watch, ref } from 'vue'
import { useFiles } from '@/composables/useFiles'
import { useMutation } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { FileItem } from './Interface'

export function useFileExplorerData(variables: any, refetch: () => void) {
  // Real data
  const { items, loading, renameFile, moveFile, downloadFile, openInProvider } = useFiles()
  
  // Search wiring -> backend filters
  const searchQuery = ref('')
  watch(searchQuery, (q) => {
    variables.value.filter.name = q || undefined
    variables.value.filter.path = q || undefined
    refetch()
  })
  
  // Canonical grouping
  const filesByCanonical = computed(() => {
    const groups: Record<string, FileItem[]> = {}
    ;(items.value as FileItem[]).forEach((f) => {
      const key = f.canonicalSlot || 'Unassigned'
      groups[key] = groups[key] || []
      groups[key].push(f)
    })
    return groups
  })
  
  const filesByCanonicalList = computed(() => {
    const out: { key: string; items: FileItem[] }[] = []
    const groups = filesByCanonical.value
    Object.keys(groups).forEach((k) => out.push({ key: k, items: groups[k] }));
    return out
  })
  
  // Computed
  const filteredFiles = computed(() => {
    let filtered = (items.value as FileItem[])

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      filtered = filtered.filter(file => 
        file.name.toLowerCase().includes(query) ||
        file.path.toLowerCase().includes(query)
      )
    }

    // Filter implementation would go here
    
    return filtered
  })
  
  return {
    items,
    loading,
    searchQuery,
    filesByCanonical,
    filesByCanonicalList,
    filteredFiles,
    renameFile,
    moveFile,
    downloadFile,
    openInProvider
  }
}
