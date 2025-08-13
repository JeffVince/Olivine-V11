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
        <v-btn
          color="primary"
          prepend-icon="mdi-sync"
          :loading="syncStatus === 'syncing'"
          @click="triggerSync"
        >
          Sync Now
        </v-btn>
        <v-btn class="ml-2" prepend-icon="mdi-upload" @click="showUploadDialog = true">
          Upload
        </v-btn>
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
        <v-card class="glass-card">
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
              <template #prepend="{ item }">
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
        <v-card class="glass-card">
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
                <v-text-field
                  v-model="searchQuery"
                  placeholder="Search files..."
                  prepend-inner-icon="mdi-magnify"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="mb-2"
                />
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
                  <v-menu>
                    <template #activator="{ props }">
                      <v-chip
                        v-bind="props"
                        size="small"
                        variant="outlined"
                        prepend-icon="mdi-filter"
                      >
                        Classification
                      </v-chip>
                    </template>
                    <v-list>
                      <v-list-item
                        v-for="s in classificationOptions"
                        :key="s.value"
                        @click="applyClassificationFilter(s.value)"
                      >
                        <v-list-item-title>{{ s.label }}</v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                </v-chip-group>
              </div>

              <!-- File Table Component -->
              <FileTable
                :filtered-files="filteredFiles"
                :loading="loading"
                :rename-file="renameFile"
                :move-file="moveFile"
                :download-file="downloadFile"
                :open-in-provider="openInProvider"
                @file-select="onFileSelect"
              />
            </template>

            <!-- Entity View -->
            <template v-else-if="viewMode === 'entity'">
              <div
                v-if="Object.keys(filesByCanonical.value).length === 0"
                class="pa-6 text-center"
              >
                <v-icon size="56" color="primary" class="mb-3">mdi-folder-star</v-icon>
                <div class="text-h6 mb-2">No canonical groupings yet</div>
                <div class="text-body-2 text-medium-emphasis mb-4">
                  Configure taxonomy rules and classifications in Mapping Studio to enable
                  canonical slot grouping.
                </div>
                <v-btn color="primary" prepend-icon="mdi-map" @click="openMappingStudio">
                  Open Mapping Studio
                </v-btn>
              </div>
              <div v-else class="pa-4">
                <v-expansion-panels variant="accordion">
                  <v-expansion-panel
                    v-for="group in filesByCanonicalList"
                    :key="group.key"
                  >
                    <v-expansion-panel-title>
                      <v-icon start>mdi-folder-star</v-icon>
                      <span class="ml-2">{{ group.key || 'Unassigned' }}</span>
                      <v-chip class="ml-3" size="x-small" label>
                        {{ group.items.length }}
                      </v-chip>
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-list density="compact">
                        <v-list-item
                          v-for="f in group.items"
                          :key="f.id"
                          @click="selectedFile = f"
                        >
                          <template #prepend>
                            <v-icon size="small">{{ mimeIcon(f.mimeType) }}</v-icon>
                          </template>
                          <v-list-item-title>{{ f.name }}</v-list-item-title>
                          <v-list-item-subtitle>{{ f.path }}</v-list-item-subtitle>
                          <template #append>
                            <v-chip
                              size="x-small"
                              :color="classificationColor(f.classificationStatus)"
                              variant="tonal"
                            >
                              {{ f.classificationStatus }}
                            </v-chip>
                          </template>
                        </v-list-item>
                      </v-list>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </div>
            </template>

            <!-- Entity View -->
            <template v-else-if="viewMode === 'entity'">
              <div class="pa-4">
                <v-tabs v-model="entityGroupBy" density="compact" class="mb-3">
                  <v-tab value="project">
                    <v-icon start>mdi-view-module</v-icon>By Project
                  </v-tab>
                  <v-tab value="source">
                    <v-icon start>mdi-cloud</v-icon>By Source
                  </v-tab>
                </v-tabs>
                <v-expansion-panels>
                  <v-expansion-panel
                    v-for="group in entityGroups"
                    :key="group.key"
                  >
                    <v-expansion-panel-title>
                      <v-icon start>{{ entityGroupIcon }}</v-icon>
                      <span class="ml-2">{{ group.label }}</span>
                      <v-chip class="ml-3" size="x-small" label>
                        {{ group.items.length }}
                      </v-chip>
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <v-list density="compact">
                        <v-list-item
                          v-for="f in group.items"
                          :key="f.id"
                          @click="selectedFile = f"
                        >
                          <template #prepend>
                            <v-icon size="small">{{ mimeIcon(f.mimeType) }}</v-icon>
                          </template>
                          <v-list-item-title>{{ f.name }}</v-list-item-title>
                          <v-list-item-subtitle>{{ f.path }}</v-list-item-subtitle>
                        </v-list-item>
                      </v-list>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </div>
            </template>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Right Panel - Inspector -->
      <v-col cols="12" lg="3">
        <!-- File Inspector Component -->
        <FileInspector
          :selected-file="selectedFile"
          :action-loading="actionLoading"
          :show-classify="showClassify"
          :classification-options="classificationOptions"
          :mime-options="mimeOptions"
          @trigger-reprocess="triggerReprocess"
          @show-classify="showClassify = $event"
          @apply-classification-filter="applyClassificationFilter"
          @apply-mime-filter="applyMimeFilter"
        />
      </v-col>
    </v-row>

    <!-- Classify Dialog Component -->
    <ClassifyDialog
      v-model="showClassify"
      :form="form"
      :canonical-slots="canonicalSlots"
      :action-loading="actionLoading"
      @submit-classification="submitClassification(form)"
    />
  </div>
</template>

<script setup lang="ts">
// Import components
import FileTable from './Components/FileTable.vue'
import FileInspector from './Components/FileInspector.vue'
import ClassifyDialog from './Components/ClassifyDialog.vue'

// Import composables
import { useFileExplorerState } from './Composables/state'
import { useFileExplorerData } from './Composables/data'
import { useFileExplorerUtils } from './Composables/utils'
import { useFileExplorerMutations } from './Composables/graphql'
import { useFileExplorerActions } from './Composables/actions'

// Import external dependencies
import { useRoute, useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'
import { useFiles } from '@/composables/useFiles'
import { ref, watch, computed } from 'vue'

// Use existing file data composable
const { items, loading, variables, refetch, renameFile, moveFile, downloadFile, openInProvider } = useFiles()

// Use modular composables
const { state, folderTree, entityGroupIcon } = useFileExplorerState()
const { 
  filesByCanonical, 
  filesByCanonicalList, 
  filteredFiles, 
  searchQuery 
} = useFileExplorerData(variables, refetch)
const { 
  getProviderColor, 
  getProviderIcon, 
  formatFileSize, 
  formatDate, 
  classificationColor, 
  mimeIcon,
  fileHeaders,
  fileFilters,
  classificationOptions,
  mimeOptions
} = useFileExplorerUtils()
const { 
  triggerReprocessMutate, 
  classifyMutate, 
  triggerFullSync, 
  CANONICAL_SLOTS_QUERY 
} = useFileExplorerMutations()
const { 
  actionLoading, 
  showClassify, 
  canonicalSlots, 
  triggerReprocess, 
  submitClassification, 
  triggerSync, 
  openMappingStudio, 
  promptRename, 
  promptMove 
} = useFileExplorerActions(
  state,
  items,
  variables,
  refetch,
  triggerReprocessMutate,
  classifyMutate,
  triggerFullSync
)

// Expose state properties for template usage
// Since state is a ref, we need to access its value
const viewMode = computed({
  get: () => state.value.viewMode,
  set: (val) => state.value.viewMode = val
})

const fileViewMode = computed({
  get: () => state.value.fileViewMode,
  set: (val) => state.value.fileViewMode = val
})

const selectedFolders = computed({
  get: () => state.value.selectedFolders,
  set: (val) => state.value.selectedFolders = val
})

const openedFolders = computed({
  get: () => state.value.openedFolders,
  set: (val) => state.value.openedFolders = val
})

const selectedFiles = computed({
  get: () => state.value.selectedFiles,
  set: (val) => state.value.selectedFiles = val
})

import type { FileItem } from './Composables/Interface'

// ...

const selectedFile = ref<FileItem | null>(null)

const selectedFilters = computed({
  get: () => state.value.selectedFilters,
  set: (val) => state.value.selectedFilters = val
})

const syncStatus = computed({
  get: () => state.value.syncStatus,
  set: (val) => state.value.syncStatus = val
})

const showUploadDialog = computed({
  get: () => state.value.showUploadDialog,
  set: (val) => state.value.showUploadDialog = val
})

const currentProvider = computed(() => state.value.currentProvider)

const entityGroupBy = computed({
  get: () => state.value.entityGroupBy,
  set: (val) => state.value.entityGroupBy = val
})

const entityGroups = computed(() => {
  // Group files by project or source based on entityGroupBy value
  if (entityGroupBy.value === 'project' && items.value) {
    const groups: { key: string; label: string; items: any[] }[] = []
    const projectMap: Record<string, any[]> = {}
    
    // Group files by project
    items.value.forEach(file => {
      const projectId = file.project?.id || 'unknown'
      if (!projectMap[projectId]) {
        projectMap[projectId] = []
      }
      projectMap[projectId].push(file)
    })
    
    // Convert to array format
    Object.keys(projectMap).forEach(projectId => {
      const project = items.value.find(f => f.project?.id === projectId)?.project
      groups.push({
        key: projectId,
        label: project?.name || 'Unknown Project',
        items: projectMap[projectId]
      })
    })
    
    return groups
  } else if (entityGroupBy.value === 'source' && items.value) {
    const groups: { key: string; label: string; items: any[] }[] = []
    const sourceMap: Record<string, any[]> = {}
    
    // Group files by source
    items.value.forEach(file => {
      const sourceId = file.source?.id || 'unknown'
      if (!sourceMap[sourceId]) {
        sourceMap[sourceId] = []
      }
      sourceMap[sourceId].push(file)
    })
    
    // Convert to array format
    Object.keys(sourceMap).forEach(sourceId => {
      const source = items.value.find(f => f.source?.id === sourceId)?.source
      groups.push({
        key: sourceId,
        label: source?.name || 'Unknown Source',
        items: sourceMap[sourceId]
      })
    })
    
    return groups
  }
  
  // Default empty array
  return []
})

// Form for classification dialog
const form = ref({
  canonicalSlot: '',
  confidence: 0.8,
})

// Missing functions that are referenced in the template
function onFolderSelect(selected: any) {
  // Vuetify treeview emits an array of selected items
  // We need to extract the IDs from the selected items
  if (Array.isArray(selected)) {
    const selectedIds = selected.map(item => typeof item === 'string' ? item : item.id)
    state.value.selectedFolders = selectedIds
  } else {
    state.value.selectedFolders = []
  }
}

function onFileSelect(file: any) {
  selectedFile.value = file
}

function applyClassificationFilter(value: string) {
  // Implementation would go here
}

function applyMimeFilter(value: string) {
  // Implementation would go here
}

// Watch search query to update filters
watch(searchQuery, (q) => {
  variables.value.filter.name = q || undefined
  variables.value.filter.path = q || undefined
  refetch()
})
</script>