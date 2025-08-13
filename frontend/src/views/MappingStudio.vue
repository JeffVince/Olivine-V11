<template>
  <div>
    <!-- Header -->
    <v-row class="mb-4">
      <v-col
        cols="12"
        md="8"
      >
        <h1 class="text-h4 font-weight-bold">
          Mapping Studio
        </h1>
        <p class="text-subtitle-1 text-medium-emphasis">
          Configure data transformations and field mappings
        </p>
      </v-col>
      <v-col
        cols="12"
        md="4"
        class="text-right"
      >
        <v-btn 
          color="primary"
          prepend-icon="mdi-plus"
          class="liquid-button"
          @click="showCreateDialog = true"
        >
          Create Mapping
        </v-btn>
      </v-col>
    </v-row>

    <!-- Mapping Templates -->
    <v-row class="mb-6">
      <v-col cols="12">
        <v-card class="glass-card">
          <v-card-title>
            <v-icon class="mr-2">
              mdi-file-document-multiple
            </v-icon>
            Mapping Templates
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col 
                v-for="template in mappingTemplates"
                :key="template.id"
                cols="12"
                sm="6"
                md="4"
              >
                 <v-card 
                  variant="outlined"
                  class="template-card glass-card"
                  @click="createFromTemplate(template)"
                >
                  <v-card-text class="text-center pa-4">
                    <v-avatar 
                      :color="template.color"
                      size="48"
                      class="mb-3"
                    >
                      <v-icon
                        :icon="template.icon"
                        size="24"
                      />
                    </v-avatar>
                    <h4 class="text-subtitle-1 mb-2">
                      {{ template.name }}
                    </h4>
                    <p class="text-body-2 text-medium-emphasis">
                      {{ template.description }}
                    </p>
                    <v-chip 
                      :color="template.color"
                      size="small"
                      variant="tonal"
                      class="mt-2"
                    >
                      {{ template.fields }} fields
                    </v-chip>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Active Mappings -->
    <v-row>
      <v-col cols="12">
        <v-card class="glass-card">
          <v-card-title class="d-flex align-center justify-space-between">
            <div>
              <v-icon class="mr-2">
                mdi-map
              </v-icon>
              Active Mappings
            </div>
            <v-btn-toggle
              v-model="viewMode"
              mandatory
            >
              <v-btn
                value="grid"
                size="small"
              >
                <v-icon>mdi-view-grid</v-icon>
              </v-btn>
              <v-btn
                value="list"
                size="small"
              >
                <v-icon>mdi-view-list</v-icon>
              </v-btn>
            </v-btn-toggle>
          </v-card-title>

          <!-- Grid View -->
          <v-card-text v-if="viewMode === 'grid'">
            <v-row>
              <v-col 
                v-for="mapping in mappings"
                :key="mapping.id"
                cols="12"
                md="6"
                lg="4"
              >
                 <v-card 
                  class="mapping-card glass-card"
                  :class="{ 'active': mapping.status === 'active' }"
                >
                  <v-card-title class="d-flex align-center">
                    <v-avatar 
                      :color="getMappingColor(mapping.type)"
                      class="mr-3"
                      size="32"
                    >
                      <v-icon
                        :icon="getMappingIcon(mapping.type)"
                        size="16"
                      />
                    </v-avatar>
                    <div class="flex-grow-1">
                      <div class="text-subtitle-1">
                        {{ mapping.name }}
                      </div>
                      <v-chip 
                        :color="mapping.status === 'active' ? 'success' : 'warning'"
                        size="x-small"
                        variant="tonal"
                      >
                        {{ mapping.status }}
                      </v-chip>
                    </div>
                    <v-menu>
                      <template #activator="{ props }">
                        <v-btn 
                          v-bind="props"
                          icon="mdi-dots-vertical"
                          variant="text"
                          size="small"
                        />
                      </template>
                      <v-list>
                        <v-list-item @click="editMapping(mapping)">
                          <v-list-item-title>
                            <v-icon start>
                              mdi-pencil
                            </v-icon>
                            Edit
                          </v-list-item-title>
                        </v-list-item>
                        <v-list-item @click="duplicateMapping(mapping)">
                          <v-list-item-title>
                            <v-icon start>
                              mdi-content-copy
                            </v-icon>
                            Duplicate
                          </v-list-item-title>
                        </v-list-item>
                        <v-list-item @click="testMapping(mapping)">
                          <v-list-item-title>
                            <v-icon start>
                              mdi-play
                            </v-icon>
                            Test
                          </v-list-item-title>
                        </v-list-item>
                        <v-divider />
                        <v-list-item
                          class="text-error"
                          @click="deleteMapping(mapping)"
                        >
                          <v-list-item-title>
                            <v-icon start>
                              mdi-delete
                            </v-icon>
                            Delete
                          </v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </v-menu>
                  </v-card-title>

                  <v-card-text>
                    <p class="text-body-2 mb-3">
                      {{ mapping.description }}
                    </p>
                    
                    <v-row class="text-center">
                      <v-col cols="4">
                        <div class="text-h6">
                          {{ mapping.fieldCount }}
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          Fields
                        </div>
                      </v-col>
                      <v-col cols="4">
                        <div class="text-h6">
                          {{ mapping.transformCount }}
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          Transforms
                        </div>
                      </v-col>
                      <v-col cols="4">
                        <div class="text-h6">
                          {{ mapping.lastRun ? formatDate(mapping.lastRun) : 'Never' }}
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          Last Run
                        </div>
                      </v-col>
                    </v-row>
                  </v-card-text>

                  <v-card-actions>
                    <v-btn 
                      :color="mapping.status === 'active' ? 'warning' : 'success'"
                      variant="outlined"
                      size="small"
                      @click="toggleMappingStatus(mapping)"
                    >
                      {{ mapping.status === 'active' ? 'Deactivate' : 'Activate' }}
                    </v-btn>
                    <v-spacer />
                    <v-btn 
                      color="primary"
                      variant="flat"
                      size="small"
                      @click="openMappingEditor(mapping)"
                    >
                      Open Editor
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>

          <!-- List View -->
          <v-card-text v-else>
            <v-data-table
              :items="mappings"
              :headers="mappingHeaders"
              item-key="id"
              density="compact"
            >
              <template #item.name="{ item }">
                <div class="d-flex align-center">
                  <v-avatar 
                    :color="getMappingColor(item.type)"
                    class="mr-3"
                    size="24"
                  >
                    <v-icon
                      :icon="getMappingIcon(item.type)"
                      size="12"
                    />
                  </v-avatar>
                  {{ item.name }}
                </div>
              </template>

              <template #item.status="{ item }">
                <v-chip 
                  :color="item.status === 'active' ? 'success' : 'warning'"
                  size="small"
                  variant="tonal"
                >
                  {{ item.status }}
                </v-chip>
              </template>

              <template #item.lastRun="{ item }">
                {{ item.lastRun ? formatDate(item.lastRun) : 'Never' }}
              </template>

              <template #item.actions="{ item }">
                <v-btn 
                  icon="mdi-pencil"
                  variant="text"
                  size="small"
                  @click="editMapping(item)"
                />
                <v-btn 
                  icon="mdi-play"
                  variant="text"
                  size="small"
                  @click="testMapping(item)"
                />
                <v-btn 
                  icon="mdi-delete"
                  variant="text"
                  size="small"
                  color="error"
                  @click="deleteMapping(item)"
                />
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Create Mapping Dialog -->
    <v-dialog
      v-model="showCreateDialog"
      max-width="600"
    >
      <v-card>
        <v-card-title>Create New Mapping</v-card-title>
        <v-card-text>
          <v-form
            ref="createForm"
            v-model="createValid"
          >
            <v-text-field
              v-model="newMapping.name"
              label="Mapping Name"
              prepend-icon="mdi-map"
              :rules="[v => !!v || 'Name is required']"
              required
            />
            
            <v-textarea
              v-model="newMapping.description"
              label="Description"
              prepend-icon="mdi-text"
              rows="3"
            />
            
            <v-select
              v-model="newMapping.type"
              :items="mappingTypes"
              label="Mapping Type"
              prepend-icon="mdi-format-list-bulleted-type"
              :rules="[v => !!v || 'Type is required']"
              required
            />
            
            <v-select
              v-model="newMapping.sourceType"
              :items="sourceTypes"
              label="Source Type"
              prepend-icon="mdi-database"
              :rules="[v => !!v || 'Source type is required']"
              required
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showCreateDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn 
            color="primary" 
            :disabled="!createValid"
            :loading="creating"
            @click="createMapping"
          >
            Create Mapping
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useNotificationStore } from '@/stores/notificationStore'

interface MappingTemplate {
  id: string
  name: string
  description: string
  icon: string
  color: string
  fields: number
  type: string
}

interface Mapping {
  id: string
  name: string
  description: string
  type: string
  status: 'active' | 'inactive'
  fieldCount: number
  transformCount: number
  lastRun?: string
}

const notificationStore = useNotificationStore()

// State
const viewMode = ref('grid')
const showCreateDialog = ref(false)
const createValid = ref(false)
const creating = ref(false)

const mappings = ref<Mapping[]>([])
const newMapping = ref({
  name: '',
  description: '',
  type: '',
  sourceType: ''
})

// Templates
const mappingTemplates: MappingTemplate[] = [
  {
    id: '1',
    name: 'File Metadata',
    description: 'Map file properties to database fields',
    icon: 'mdi-file',
    color: 'blue',
    fields: 8,
    type: 'file-metadata'
  },
  {
    id: '2',
    name: 'User Directory',
    description: 'Map user information from directory services',
    icon: 'mdi-account-group',
    color: 'green',
    fields: 12,
    type: 'user-directory'
  },
  {
    id: '3',
    name: 'Project Structure',
    description: 'Map project hierarchy and relationships',
    icon: 'mdi-folder-multiple',
    color: 'orange',
    fields: 6,
    type: 'project-structure'
  },
  {
    id: '4',
    name: 'Asset Metadata',
    description: 'Map media asset properties and tags',
    icon: 'mdi-image-multiple',
    color: 'purple',
    fields: 15,
    type: 'asset-metadata'
  }
]

const mappingTypes = [
  { title: 'File Metadata', value: 'file-metadata' },
  { title: 'User Directory', value: 'user-directory' },
  { title: 'Project Structure', value: 'project-structure' },
  { title: 'Asset Metadata', value: 'asset-metadata' },
  { title: 'Custom', value: 'custom' }
]

const sourceTypes = [
  { title: 'Dropbox', value: 'dropbox' },
  { title: 'Google Drive', value: 'googledrive' },
  { title: 'Local Files', value: 'local' },
  { title: 'Database', value: 'database' },
  { title: 'API', value: 'api' }
]

const mappingHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Type', key: 'type', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Fields', key: 'fieldCount', sortable: true },
  { title: 'Transforms', key: 'transformCount', sortable: true },
  { title: 'Last Run', key: 'lastRun', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
]

// Methods
function getMappingColor(type: string) {
  switch (type) {
    case 'file-metadata': return 'blue'
    case 'user-directory': return 'green'
    case 'project-structure': return 'orange'
    case 'asset-metadata': return 'purple'
    default: return 'grey'
  }
}

function getMappingIcon(type: string) {
  switch (type) {
    case 'file-metadata': return 'mdi-file'
    case 'user-directory': return 'mdi-account-group'
    case 'project-structure': return 'mdi-folder-multiple'
    case 'asset-metadata': return 'mdi-image-multiple'
    default: return 'mdi-map'
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString()
}

function createFromTemplate(template: MappingTemplate) {
  newMapping.value = {
    name: `${template.name} Mapping`,
    description: template.description,
    type: template.type,
    sourceType: 'dropbox'
  }
  showCreateDialog.value = true
}

async function createMapping() {
  creating.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const mapping: Mapping = {
      id: Date.now().toString(),
      name: newMapping.value.name,
      description: newMapping.value.description,
      type: newMapping.value.type,
      status: 'inactive',
      fieldCount: 0,
      transformCount: 0
    }
    
    mappings.value.push(mapping)
    showCreateDialog.value = false
    
    newMapping.value = { name: '', description: '', type: '', sourceType: '' }
    notificationStore.add('success', 'Mapping created successfully')
  } catch (error) {
    notificationStore.add('error', 'Failed to create mapping')
  } finally {
    creating.value = false
  }
}

function editMapping(mapping: Mapping) {
  notificationStore.add('info', `Opening editor for ${mapping.name}`)
}

function openMappingEditor(mapping: Mapping) {
  editMapping(mapping)
}

async function testMapping(mapping: Mapping) {
  try {
    await new Promise(resolve => setTimeout(resolve, 2000))
    notificationStore.add('success', `Test completed for ${mapping.name}`)
  } catch (error) {
    notificationStore.add('error', `Test failed for ${mapping.name}`)
  }
}

function duplicateMapping(mapping: Mapping) {
  const duplicate: Mapping = {
    ...mapping,
    id: Date.now().toString(),
    name: `${mapping.name} (Copy)`,
    status: 'inactive'
  }
  mappings.value.push(duplicate)
  notificationStore.add('success', 'Mapping duplicated successfully')
}

function toggleMappingStatus(mapping: Mapping) {
  mapping.status = mapping.status === 'active' ? 'inactive' : 'active'
  notificationStore.add('info', `Mapping ${mapping.status === 'active' ? 'activated' : 'deactivated'}`)
}

function deleteMapping(mapping: Mapping) {
  const index = mappings.value.findIndex(m => m.id === mapping.id)
  if (index > -1) {
    mappings.value.splice(index, 1)
    notificationStore.add('info', 'Mapping deleted')
  }
}

// Load mappings on mount
onMounted(() => {
  mappings.value = [
    {
      id: '1',
      name: 'Dropbox File Metadata',
      description: 'Maps Dropbox file properties to project database',
      type: 'file-metadata',
      status: 'active',
      fieldCount: 6,
      transformCount: 3,
      lastRun: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      name: 'User Directory Sync',
      description: 'Synchronizes user information from Active Directory',
      type: 'user-directory',
      status: 'active',
      fieldCount: 8,
      transformCount: 2,
      lastRun: '2024-01-14T15:45:00Z'
    },
    {
      id: '3',
      name: 'Project Structure',
      description: 'Maps project folder hierarchy',
      type: 'project-structure',
      status: 'inactive',
      fieldCount: 4,
      transformCount: 1
    }
  ]
})
</script>

<style scoped>
.template-card {
  cursor: pointer;
  transition: all 0.2s ease;
}

.template-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.mapping-card {
  transition: all 0.3s ease;
}

.mapping-card.active {
  border-left: 4px solid rgb(var(--v-theme-success));
}
</style>


