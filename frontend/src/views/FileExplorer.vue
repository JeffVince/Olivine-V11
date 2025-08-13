<template>
  <div>
    <!-- Header -->
    <v-row class="mb-4">
      <v-col
        cols="12"
        md="8"
      >
        <h1 class="text-h4 font-weight-bold">
          File Explorer
        </h1>
        <p class="text-subtitle-1 text-medium-emphasis">
          Browse and manage project files from connected storage
        </p>
      </v-col>
      <v-col
        cols="12"
        md="4"
        class="text-right"
      >
        <v-btn-group density="compact">
          <v-btn 
            :color="syncStatus === 'syncing' ? 'warning' : 'primary'"
            :loading="syncStatus === 'syncing'"
            prepend-icon="mdi-sync"
            class="liquid-button"
            @click="triggerSync"
          >
            {{ syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now' }}
          </v-btn>
          <v-btn 
            prepend-icon="mdi-upload"
            class="liquid-button"
            @click="showUploadDialog = true"
          >
            Upload
          </v-btn>
        </v-btn-group>
      </v-col>
    </v-row>

    <!-- View Mode Tabs -->
    <v-tabs
      v-model="viewMode"
      class="mb-4"
    >
      <v-tab value="source">
        <v-icon start>
          mdi-folder-outline
        </v-icon>
        Source View
      </v-tab>
      <v-tab value="canonical">
        <v-icon start>
          mdi-folder-star
        </v-icon>
        Canonical View
      </v-tab>
      <v-tab value="entity">
        <v-icon start>
          mdi-sitemap
        </v-icon>
        Entity View
      </v-tab>
    </v-tabs>

    <!-- Main Content -->
    <v-row>
      <!-- Left Panel - Folder Tree -->
      <v-col
        cols="12"
        lg="3"
      >
        <v-card class="glass-card">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">
              mdi-folder-multiple
            </v-icon>
            Folders
            <v-spacer />
            <v-chip 
              :color="getProviderColor(currentProvider)" 
              size="small"
              variant="tonal"
            >
              <v-icon
                start
                size="small"
              >
                {{ getProviderIcon(currentProvider) }}
              </v-icon>
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
            <div
              v-if="folderTree.length === 0"
              class="text-medium-emphasis pa-4"
            >
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
      <v-col
        cols="12"
        lg="6"
      >
        <v-card class="glass-card">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">
              mdi-file-multiple
            </v-icon>
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
                <v-chip-group
                  v-model="selectedFilters"
                  multiple
                >
                  <v-chip
                    v-for="filter in fileFilters"
                    :key="filter.key"
                    :value="filter.key"
                    size="small"
                    variant="outlined"
                  >
                    <v-icon
                      start
                      size="small"
                    >
                      {{ filter.icon }}
                    </v-icon>
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

              <v-data-table 
                v-model:selected="selectedFiles"
                :items="filteredFiles"
                :headers="fileHeaders"
                item-key="id"
                show-select
                @click:row="onFileSelect"
              >
                <template #item.name="{ item }">
                  <div class="d-flex align-center">
                    <v-icon
                      class="mr-2"
                      size="small"
                    >
                      mdi-file
                    </v-icon>
                    <span>{{ item.name }}</span>
                    <v-chip
                      v-if="item.classificationStatus && item.classificationStatus !== 'PENDING'"
                      class="ml-2"
                      :color="classificationColor(item.classificationStatus)"
                      size="x-small"
                      label
                      variant="tonal"
                    >
                      {{ item.classificationStatus }}
                    </v-chip>
                    <v-chip
                      v-if="item.metadata?.policyViolations?.length"
                      class="ml-1"
                      color="red"
                      size="x-small"
                      label
                      variant="tonal"
                    >
                      {{ item.metadata.policyViolations.length }} PV
                    </v-chip>
                    <v-chip
                      v-if="item.metadata?.suggestions?.length"
                      class="ml-1"
                      color="blue"
                      size="x-small"
                      label
                      variant="tonal"
                    >
                      {{ item.metadata.suggestions.length }} SG
                    </v-chip>
                  </div>
                </template>
                <template #item.size="{ item }">
                  {{ formatFileSize(item.size || 0) }}
                </template>
                <template #item.updatedAt="{ item }">
                  {{ formatDate(item.updatedAt) }}
                </template>
                <template #item.mimeType="{ item }">
                  <div class="d-flex align-center">
                    <v-icon
                      class="mr-1"
                      size="x-small"
                    >
                      {{ mimeIcon(item.mimeType) }}
                    </v-icon>
                    <span>{{ item.mimeType }}</span>
                  </div>
                </template>
                <template #item.actions="{ item }">
                  <v-menu>
                    <template #activator="{ props }">
                      <v-btn
                        icon="mdi-dots-vertical"
                        v-bind="props"
                        variant="text"
                      />
                    </template>
                    <v-list>
                      <v-list-item @click.stop="promptRename(item)">
                        <v-list-item-title>Rename</v-list-item-title>
                      </v-list-item>
                      <v-list-item @click.stop="promptMove(item)">
                        <v-list-item-title>Move</v-list-item-title>
                      </v-list-item>
                      <v-list-item @click.stop="downloadFile(item)">
                        <v-list-item-title>Download</v-list-item-title>
                      </v-list-item>
                      <v-list-item @click.stop="openInProvider(item)">
                        <v-list-item-title>Open in Provider</v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                </template>
              </v-data-table>
            </template>

            <!-- Canonical View -->
            <template v-else-if="viewMode === 'canonical'">
              <div
                v-if="Object.keys(filesByCanonical.value).length === 0"
                class="pa-6 text-center"
              >
                <v-icon
                  size="56"
                  color="primary"
                  class="mb-3"
                >
                  mdi-folder-star
                </v-icon>
                <div class="text-h6 mb-2">
                  No canonical groupings yet
                </div>
                <div class="text-body-2 text-medium-emphasis mb-4">
                  Configure taxonomy rules and classifications in Mapping Studio to enable canonical slot grouping.
                </div>
                <v-btn
                  color="primary"
                  prepend-icon="mdi-map"
                  @click="openMappingStudio"
                >
                  Open Mapping Studio
                </v-btn>
              </div>
              <div
                v-else
                class="pa-4"
              >
                <v-expansion-panels variant="accordion">
                  <v-expansion-panel
                    v-for="group in filesByCanonicalList"
                    :key="group.key"
                  >
                    <v-expansion-panel-title>
                      <v-icon start>
                        mdi-folder-star
                      </v-icon>
                      <span class="ml-2">{{ group.key || 'Unassigned' }}</span>
                      <v-chip
                        class="ml-3"
                        size="x-small"
                        label
                      >
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
                            <v-icon size="small">
                              {{ mimeIcon(f.mimeType) }}
                            </v-icon>
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
                <v-tabs
                  v-model="entityGroupBy"
                  density="compact"
                  class="mb-3"
                >
                  <v-tab value="project">
                    <v-icon start>
                      mdi-view-module
                    </v-icon>By Project
                  </v-tab>
                  <v-tab value="source">
                    <v-icon start>
                      mdi-cloud
                    </v-icon>By Source
                  </v-tab>
                </v-tabs>
                <v-expansion-panels>
                  <v-expansion-panel
                    v-for="group in entityGroups"
                    :key="group.key"
                  >
                    <v-expansion-panel-title>
                      <v-icon start>
                        {{ entityGroupIcon }}
                      </v-icon>
                      <span class="ml-2">{{ group.label }}</span>
                      <v-chip
                        class="ml-3"
                        size="x-small"
                        label
                      >
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
                            <v-icon size="small">
                              {{ mimeIcon(f.mimeType) }}
                            </v-icon>
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
      <v-col
        cols="12"
        lg="3"
      >
        <!-- Right Panel - Inspector / Facets -->
        <v-card v-if="selectedFile" class="glass-card">
          <v-card-title>
            <v-icon class="mr-2">
              mdi-information
            </v-icon>
            Inspector
          </v-card-title>
          
          <v-card-text>
            <h4 class="text-subtitle-2 mb-2">
              {{ selectedFile.name }}
            </h4>
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
                <v-list-item-subtitle class="text-wrap">
                  {{ selectedFile.path }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>MIME</v-list-item-title>
                <v-list-item-subtitle class="text-wrap">
                  {{ selectedFile.mimeType }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-if="selectedFile.metadata?.preview || selectedFile.extractedText">
                <v-list-item-title>Preview</v-list-item-title>
                <v-list-item-subtitle
                  class="text-wrap"
                  style="white-space: pre-wrap; max-height: 240px; overflow: auto;"
                >
                  {{ selectedFile.metadata?.preview || selectedFile.extractedText }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Classification</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip
                    :color="classificationColor(selectedFile.classificationStatus)"
                    size="small"
                    label
                    variant="tonal"
                  >
                    {{ selectedFile.classificationStatus }}
                  </v-chip>
                  <span
                    v-if="selectedFile.classificationConfidence"
                    class="ml-2 text-medium-emphasis"
                  >
                    {{ (selectedFile.classificationConfidence * 100).toFixed(0) }}%
                  </span>
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-if="selectedFile.canonicalSlot">
                <v-list-item-title>Canonical Slot</v-list-item-title>
                <v-list-item-subtitle>{{ selectedFile.canonicalSlot }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <div class="mt-4 d-flex gap-2">
              <v-btn
                color="primary"
                prepend-icon="mdi-refresh"
                :loading="actionLoading"
                @click="triggerReprocess"
              >
                Reprocess
              </v-btn>
              <v-btn
                color="secondary"
                prepend-icon="mdi-tag"
                @click="showClassify = true"
              >
                Classify
              </v-btn>
              <v-btn
                v-if="selectedFile.metadata?.downloadUrl"
                :href="selectedFile.metadata.downloadUrl"
                target="_blank"
                prepend-icon="mdi-download"
              >
                Download
              </v-btn>
              <v-btn
                v-if="selectedFile.metadata?.previewUrl"
                :href="selectedFile.metadata.previewUrl"
                target="_blank"
                prepend-icon="mdi-open-in-new"
              >
                Open Preview
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
        
        <!-- Empty Inspector State -->
        <v-card
          v-else
          class="text-center pa-8 glass-card"
        >
          <v-icon
            size="48"
            color="grey-lighten-1"
          >
            mdi-cursor-default-click
          </v-icon>
          <p class="text-medium-emphasis mt-2">
            Select a file to view details
          </p>
          <v-divider class="my-4" />
          <div class="text-left">
            <div class="text-subtitle-2 mb-2">
              Facets
            </div>
            <v-list density="compact">
              <v-list-subheader>Classification</v-list-subheader>
              <v-list-item
                v-for="s in classificationOptions"
                :key="s.value"
                @click="applyClassificationFilter(s.value)"
              >
                <template #prepend>
                  <v-icon size="x-small">
                    mdi-tag
                  </v-icon>
                </template>
                <v-list-item-title>{{ s.label }}</v-list-item-title>
              </v-list-item>
              <v-divider class="my-2" />
              <v-list-subheader>MIME Type</v-list-subheader>
              <v-list-item
                v-for="m in mimeOptions"
                :key="m.value"
                @click="applyMimeFilter(m.value)"
              >
                <template #prepend>
                  <v-icon size="x-small">
                    {{ mimeIcon(m.value) }}
                  </v-icon>
                </template>
                <v-list-item-title>{{ m.label }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Classify Dialog -->
    <v-dialog
      v-model="showClassify"
      max-width="500"
    >
      <v-card class="glass-card">
        <v-card-title>
          <v-icon class="mr-2">
            mdi-tag
          </v-icon>
          Classify File
        </v-card-title>
        <v-card-text>
          <v-select
            v-model="form.canonicalSlot"
            :items="canonicalSlots"
            item-title="key"
            item-value="key"
            label="Canonical Slot"
          />
          <v-slider
            v-model="form.confidence"
            min="0"
            max="1"
            step="0.01"
            label="Confidence"
            class="mt-4"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showClassify = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :loading="actionLoading"
            @click="submitClassification"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'
import { useFiles } from '@/composables/useFiles'
import { useMutation } from '@vue/apollo-composable'
import gql from 'graphql-tag'

interface FileItem {
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
const { items, loading, variables, refetch, renameFile, moveFile, downloadFile, openInProvider } = useFiles()

// Search wiring -> backend filters
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
  Object.keys(groups).forEach((k) => out.push({ key: k, items: groups[k] }))
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

// Entity grouping state
const entityGroupBy = ref<'project' | 'source'>('project')
const entityGroupIcon = computed(() => entityGroupBy.value === 'project' ? 'mdi-view-module' : 'mdi-cloud')
const entityGroups = computed(() => {
  const groups: Record<string, { key: string; label: string; items: FileItem[] }> = {}
  const list = (items.value as any[])
  const by = entityGroupBy.value
  for (const f of list) {
    const key = by === 'project' ? (f.project?.id || 'Unassigned') : (f.source?.id || 'Unassigned')
    const label = by === 'project' ? (f.project?.name || 'Unassigned Project') : ((f.source?.name || 'Unassigned Source'))
    if (!groups[key]) groups[key] = { key, label, items: [] }
    groups[key].items.push(f as FileItem)
  }
  return Object.values(groups)
})

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
const classificationOptions = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'CLASSIFIED', label: 'Classified' },
  { value: 'MANUAL_REVIEW', label: 'Manual review' },
  { value: 'FAILED', label: 'Failed' },
]

function applyClassificationFilter(status: string) {
  variables.value.filter.classificationStatus = status
  refetch()
}

const mimeOptions = [
  { value: 'application/pdf', label: 'PDF' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'text/plain', label: 'Text' },
  { value: 'application/json', label: 'JSON' },
]

function applyMimeFilter(mime: string) {
  variables.value.filter.mimeType = mime
  refetch()
}


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

function onFolderSelect(folders: unknown) {
  // Handle folder selection
  console.log('Selected folders:', folders)
}

function onFileSelect(event: any, { item }: { item: FileItem }) {
  selectedFile.value = item
}

// (legacy triggerSync removed; using GraphQL-driven trigger below)

function openMappingStudio() {
  const projectId = route.params.id as string
  router.push({ name: 'MappingStudio', params: { id: projectId } })
}

async function promptRename(file: FileItem) {
  const name = window.prompt('Rename file', file.name)
  if (name && name !== file.name) {
    try {
      await renameFile(file.id, name)
      notificationStore.add('success', 'File renamed')
    } catch (e: any) {
      notificationStore.add('error', e.message || 'Rename failed')
    }
  }
}

async function promptMove(file: FileItem) {
  const path = window.prompt('Move file to path', file.path)
  if (path && path !== file.path) {
    try {
      await moveFile(file.id, path)
      notificationStore.add('success', 'File moved')
    } catch (e: any) {
      notificationStore.add('error', e.message || 'Move failed')
    }
  }
}

// Actions
const actionLoading = ref(false)
const showClassify = ref(false)

const REPROCESS_MUTATION = gql`
  mutation TriggerFileReprocessing($fileId: ID!, $orgId: ID!) {
    triggerFileReprocessing(fileId: $fileId, orgId: $orgId)
  }
`

const CLASSIFY_MUTATION = gql`
  mutation ClassifyFile($input: ClassifyFileInput!) {
    classifyFile(input: $input) {
      id
      classificationStatus
      classificationConfidence
      canonicalSlot
      updatedAt
    }
  }
`

const { mutate: triggerReprocessMutate } = useMutation(REPROCESS_MUTATION)
const { mutate: classifyMutate } = useMutation(CLASSIFY_MUTATION)

async function triggerReprocess() {
  if (!selectedFile.value) return
  actionLoading.value = true
  try {
    await triggerReprocessMutate({ fileId: selectedFile.value.id, orgId: (items.value[0] && items.value[0].orgId) || '' })
    notificationStore.add('success', 'Reprocessing triggered')
  } catch (e:any) {
    notificationStore.add('error', e.message || 'Failed to trigger reprocessing')
  } finally {
    actionLoading.value = false
  }
}

// Load canonical slots for classification dialog
const CANONICAL_SLOTS_QUERY = gql`
  query CanonicalSlots($orgId: ID!) {
    canonicalSlots(orgId: $orgId) { key }
  }
`

const canonicalSlots = ref<Array<{ key: string }>>([])
watch(
  () => variables.value.filter.orgId,
  async (orgId) => {
    if (!orgId) return
    try {
      const res: any = await (await import('@apollo/client/core')).ApolloClient.prototype.query.call(
        (await import('@/graphql/client')).apolloClient,
        { query: CANONICAL_SLOTS_QUERY, variables: { orgId } }
      )
      const data = (res as any).data as any
      canonicalSlots.value = data?.canonicalSlots || []
    } catch (e) {
      // noop
    }
  },
  { immediate: true }
)

const form = ref({ canonicalSlot: '', confidence: 0.9 })
async function submitClassification() {
  if (!selectedFile.value) return
  actionLoading.value = true
  try {
    await classifyMutate({
      input: {
        fileId: selectedFile.value.id,
        orgId: (items.value[0] && items.value[0].orgId) || variables.value.filter.orgId,
        canonicalSlot: form.value.canonicalSlot,
        confidence: form.value.confidence,
      },
    })
    notificationStore.add('success', 'File classified')
    showClassify.value = false
    refetch()
  } catch (e:any) {
    notificationStore.add('error', e.message || 'Failed to classify file')
  } finally {
    actionLoading.value = false
  }
}

// Sync Now triggers full org sync
const TRIGGER_FULL_SYNC = gql`
  mutation TriggerFullSync($orgId: ID!) { triggerFullSync(orgId: $orgId) }
`
const { mutate: triggerFullSync } = useMutation(TRIGGER_FULL_SYNC)
async function triggerSync() {
  syncStatus.value = 'syncing'
  try {
    await triggerFullSync({ orgId: variables.value.filter.orgId as string })
    notificationStore.add('success', 'Sync triggered')
  } catch (e:any) {
    notificationStore.add('error', e.message || 'Sync failed')
    syncStatus.value = 'error'
    return
  }
  setTimeout(() => {
    syncStatus.value = 'idle'
  }, 1500)
}
</script>
