import { ref, computed } from 'vue'
import type { Mapping, MappingTemplate, NewMapping } from '@/views/MappingStudio/Composables/types'

// Reactive state
const mappings = ref<Mapping[]>([])
const mappingTemplates = ref<MappingTemplate[]>([
  {
    id: '1',
    name: 'File Metadata',
    description: 'Map file properties like name, size, and timestamps',
    type: 'file-metadata',
    icon: 'mdi-file',
    color: 'blue'
  },
  {
    id: '2',
    name: 'User Directory',
    description: 'Map user directory structures and permissions',
    type: 'user-directory',
    icon: 'mdi-account-group',
    color: 'green'
  },
  {
    id: '3',
    name: 'Project Structure',
    description: 'Map project folder hierarchies and organization',
    type: 'project-structure',
    icon: 'mdi-folder-multiple',
    color: 'orange'
  }
])
const newMapping = ref<NewMapping>({
  name: '',
  description: '',
  type: '',
  sourceType: ''
})
const showCreateDialog = ref(false)
const creating = ref(false)
const viewMode = ref<'grid' | 'list'>('grid')

// Computed properties
const activeMappingsCount = computed(() => 
  mappings.value.filter(m => m.status === 'active').length
)

const inactiveMappingsCount = computed(() => 
  mappings.value.filter(m => m.status === 'inactive').length
)

// Export state and computed properties
export function useState() {
  return {
    // State
    mappings,
    mappingTemplates,
    newMapping,
    showCreateDialog,
    creating,
    viewMode,
    
    // Computed
    activeMappingsCount,
    inactiveMappingsCount
  }
}
