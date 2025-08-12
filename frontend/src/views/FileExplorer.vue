<template>
  <div>
    <!-- Header -->
    <v-row class="mb-4">
      <v-col cols="12" md="8">
        <h1 class="text-h4 font-weight-bold">File Explorer</h1>
        <p class="text-subtitle-1 text-medium-emphasis">
          Browse and manage project files from connected storage
        </p>
      </v-col>
      <v-col cols="12" md="4" class="text-right">
        <v-btn-group>
          <v-btn 
            :color="syncStatus === 'syncing' ? 'warning' : 'primary'"
            :loading="syncStatus === 'syncing'"
            @click="triggerSync"
            prepend-icon="mdi-sync"
          >
            {{ syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now' }}
          </v-btn>
          <v-btn 
            prepend-icon="mdi-upload"
            @click="showUploadDialog = true"
          >
            Upload
          </v-btn>
        </v-btn-group>
      </v-col>
    </v-row>

    <!-- View Mode Tabs -->
    <v-tabs v-model="viewMode" class="mb-4">
      <v-tab value="source">
        <v-icon start>mdi-folder-outline</v-icon>
        Source View
      </v-tab>
      <v-tab value="canonical">
        <v-icon start>mdi-folder-star</v-icon>
        Canonical View
      </v-tab>
      <v-tab value="entity">
        <v-icon start>mdi-sitemap</v-icon>
        Entity View
      </v-tab>
    </v-tabs>

    <!-- Main Content -->
    <v-row>
      <!-- Left Panel - Folder Tree -->
      <v-col cols="12" lg="3">
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-folder-multiple</v-icon>
            Folders
            <v-spacer />
            <v-chip 
              :color="getProviderColor(currentProvider)" 
              size="small"
              variant="tonal"
            >
              <v-icon start size="small">{{ getProviderIcon(currentProvider) }}</v-icon>
              {{ currentProvider }}
            </v-chip>
          </v-card-title>
          
           <v-card-text class="pa-0">
            <!-- Search -->
            <v-text-field
              v-model="searchQuery"
              placeholder="Search files..."
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="compact"
              hide-details
              class="ma-3"
            />

            <!-- Folder Tree (pending backend wiring) -->
            <div v-if="folderTree.length === 0" class="text-medium-emphasis pa-4">
              Folder tree integration is coming soon.
            </div>
            <v-treeview
              v-else
              v-model:selected="selectedFolders"
              v-model:opened="openedFolders"
              :items="folderTree"
              item-key="id"
              item-title="name"
              item-children="children"
              selectable
              open-on-click
              @update:selected="onFolderSelect"
            >
              <template v-slot:prepend="{ item }">
                <v-icon size="small">
                  {{ item.type === 'folder' ? 'mdi-folder' : 'mdi-file' }}
                </v-icon>
              </template>
            </v-treeview>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Center Panel - File List -->
      <v-col cols="12" lg="6">
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-file-multiple</v-icon>
            Files
            <v-spacer />
            <v-btn-group density="compact">
              <v-btn 
                :variant="fileViewMode === 'table' ? 'flat' : 'text'"
                icon="mdi-view-list"
                @click="fileViewMode = 'table'"
              />
              <v-btn 
                :variant="fileViewMode === 'grid' ? 'flat' : 'text'"
                icon="mdi-view-grid"
                @click="fileViewMode = 'grid'"
              />
            </v-btn-group>
          </v-card-title>
          
          <v-card-text class="pa-0">
            <!-- Source View -->
            <template v-if="viewMode === 'source'">
              <div class="px-4 pb-2">
                <v-chip-group v-model="selectedFilters" multiple>
                  <v-chip 
                    v-for="filter in fileFilters"
                    :key="filter.key"
                    :value="filter.key"
                    size="small"
                    variant="outlined"
                  >
                    <v-icon start size="small">{{ filter.icon }}</v-icon>
                    {{ filter.label }}
                  </v-chip>
                </v-chip-group>
              </div>

              <v-data-table 
                v-model:selected="selectedFiles"
                :items="filteredFiles"
                :headers="fileHeaders"
                item-key="id"
                show-select
                @click:row="onFileSelect"
              >
                <template v-slot:item.name="{ item }">
                  <div class="d-flex align-center">
                    <v-icon class="mr-2" size="small">mdi-file</v-icon>
                    <span>{{ item.name }}</span>
                  </div>
                </template>
                <template v-slot:item.size="{ item }">
                  {{ formatFileSize(item.size || 0) }}
                </template>
                <template v-slot:item.updatedAt="{ item }">
                  {{ formatDate(item.updatedAt) }}
                </template>
              </v-data-table>
            </template>

            <!-- Canonical View -->
            <template v-else-if="viewMode === 'canonical'">
              <div class="pa-6 text-center">
                <v-icon size="56" color="primary" class="mb-3">mdi-folder-star</v-icon>
                <div class="text-h6 mb-2">Canonical view requires file classifications</div>
                <div class="text-body-2 text-medium-emphasis mb-4">
                  Configure taxonomy rules and classifications in Mapping Studio to enable canonical slot grouping.
                </div>
                <v-btn color="primary" prepend-icon="mdi-map" @click="openMappingStudio">
                  Open Mapping Studio
                </v-btn>
              </div>
            </template>

            <!-- Entity View -->
            <template v-else-if="viewMode === 'entity'">
              <div class="pa-6 text-center">
                <v-icon size="56" color="primary" class="mb-3">mdi-sitemap</v-icon>
                <div class="text-h6 mb-2">Entity view not yet connected</div>
                <div class="text-body-2 text-medium-emphasis">
                  When entity links are available (e.g., Scenes, Shoot Days), files will be grouped by related entities here.
                </div>
              </div>
            </template>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Right Panel - Inspector -->
      <v-col cols="12" lg="3">
        <v-card v-if="selectedFile">
          <v-card-title>
            <v-icon class="mr-2">mdi-information</v-icon>
            Inspector
          </v-card-title>
          
          <v-card-text>
            <h4 class="text-subtitle-2 mb-2">{{ selectedFile.name }}</h4>
            <v-list density="compact">
              <v-list-item>
                <v-list-item-title>Size</v-list-item-title>
                <v-list-item-subtitle>{{ formatFileSize(selectedFile.size || 0) }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Updated</v-list-item-title>
                <v-list-item-subtitle>{{ formatDate((selectedFile as any).updatedAt || '') }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Path</v-list-item-title>
                <v-list-item-subtitle class="text-wrap">{{ selectedFile.path }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>MIME</v-list-item-title>
                <v-list-item-subtitle class="text-wrap">{{ selectedFile.mimeType }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
        
        <!-- Empty Inspector State -->
        <v-card v-else class="text-center pa-8">
          <v-icon size="48" color="grey-lighten-1">mdi-cursor-default-click</v-icon>
          <p class="text-medium-emphasis mt-2">Select a file to view details</p>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'
import { useFiles } from '@/composables/useFiles'

interface FileItem {
  id: string
  name: string
  path: string
  size?: number
  mimeType?: string
  updatedAt: string
  current?: boolean
  deleted?: boolean
}

interface FolderItem {
  id: string
  name: string
  type: 'folder' | 'file'
  children?: FolderItem[]
  fileCount?: number
  hasIssues?: boolean
}

const route = useRoute()
const router = useRouter()
const notificationStore = useNotificationStore()

// State
const viewMode = ref('source')
const fileViewMode = ref('table')
const searchQuery = ref('')
const selectedFolders = ref<string[]>([])
const openedFolders = ref<string[]>(['root'])
const selectedFiles = ref<FileItem[]>([])
const selectedFile = ref<FileItem | null>(null)
const selectedFilters = ref<string[]>([])
const syncStatus = ref<'idle' | 'syncing' | 'error'>('idle')
const showUploadDialog = ref(false)

// Provider chip and folder tree placeholders (no mock content)
const currentProvider = ref('Unknown')
const folderTree = ref<FolderItem[]>([])

// Real data
const { items, loading } = useFiles()

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

  if (selectedFilters.value.length > 0) {
    filtered = filtered.filter(file => {
      return selectedFilters.value.some(filter => {
        switch (filter) {
          case 'current': return file.current === true
          case 'deleted': return file.deleted === true
          default: return true
        }
      })
    })
  }

  return filtered
})

// File headers for table view (aligned to available data)
const fileHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'MIME', key: 'mimeType', sortable: true },
  { title: 'Size', key: 'size', sortable: true },
  { title: 'Updated', key: 'updatedAt', sortable: true }
]

// File filters
const fileFilters = [
  { key: 'current', label: 'Current', icon: 'mdi-check-circle' },
  { key: 'deleted', label: 'Deleted', icon: 'mdi-delete' }
]

// Methods
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

function onFolderSelect(folders: unknown) {
  // Handle folder selection
  console.log('Selected folders:', folders)
}

function onFileSelect(event: any, { item }: { item: FileItem }) {
  selectedFile.value = item
}

function triggerSync() {
  syncStatus.value = 'syncing'
  setTimeout(() => {
    syncStatus.value = 'idle'
    notificationStore.add('success', 'Files synced successfully')
  }, 2000)
}

function openMappingStudio() {
  const projectId = route.params.id as string
  router.push({ name: 'MappingStudio', params: { id: projectId } })
}
</script>
