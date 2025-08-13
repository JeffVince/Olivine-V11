import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileItem, FolderItem, FileExplorerState } from './Interface'

export function useFileExplorerState() {
  const route = useRoute()
  
  // State
  const state = ref<FileExplorerState>({
    viewMode: 'source',
    fileViewMode: 'table',
    searchQuery: '',
    selectedFolders: [],
    openedFolders: ['root'],
    selectedFiles: [],
    selectedFile: null,
    selectedFilters: [],
    syncStatus: 'idle',
    showUploadDialog: false,
    currentProvider: 'Unknown',
    actionLoading: false,
    showClassify: false,
    entityGroupBy: 'project'
  })
  
  // Folder tree placeholder
  const folderTree = ref<FolderItem[]>([])
  
  // Computed properties
  const entityGroupIcon = computed(() => 
    state.value.entityGroupBy === 'project' ? 'mdi-view-module' : 'mdi-cloud'
  )
  
  return {
    state,
    folderTree,
    entityGroupIcon
  }
}
