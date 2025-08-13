import { ref } from 'vue'
import { useNotificationStore } from '@/stores/notificationStore'
import type { Mapping, MappingTemplate, NewMapping } from '@/views/MappingStudio/Composables/types'
import { useState } from '@/views/MappingStudio/Composables/state'

const notificationStore = useNotificationStore()
const { mappings, newMapping, showCreateDialog, creating } = useState()

// Helper functions
function getMappingColor(type: string): string {
  switch (type) {
    case 'file-metadata': return 'blue'
    case 'user-directory': return 'green'
    case 'project-structure': return 'orange'
    case 'asset-metadata': return 'purple'
    default: return 'grey'
  }
}

function getMappingIcon(type: string): string {
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

// Action functions
async function createMapping(mappingData: NewMapping) {
  creating.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const mapping: Mapping = {
      id: Date.now().toString(),
      name: mappingData.name,
      description: mappingData.description,
      type: mappingData.type,
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

function createFromTemplate(template: MappingTemplate) {
  newMapping.value = {
    name: `${template.name} Mapping`,
    description: template.description,
    type: template.type,
    sourceType: 'dropbox'
  }
  showCreateDialog.value = true
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

// Initialize with sample data
function initializeMappings() {
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
      name: 'User Directory Structure',
      description: 'Maps user directory hierarchies and permissions',
      type: 'user-directory',
      status: 'inactive',
      fieldCount: 4,
      transformCount: 2
    },
    {
      id: '3',
      name: 'Project Asset Metadata',
      description: 'Maps asset metadata for project organization',
      type: 'asset-metadata',
      status: 'active',
      fieldCount: 8,
      transformCount: 5,
      lastRun: '2024-01-14T15:45:00Z'
    }
  ]
}

// Export actions
export function useActions() {
  return {
    // Helper functions
    getMappingColor,
    getMappingIcon,
    formatDate,
    
    // Action functions
    createMapping,
    createFromTemplate,
    editMapping,
    openMappingEditor,
    testMapping,
    duplicateMapping,
    toggleMappingStatus,
    deleteMapping,
    
    // Initialization
    initializeMappings
  }
}
