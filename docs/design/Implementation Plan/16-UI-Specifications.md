# User Interface Specifications Implementation
## Detailed UI/UX Design and Component Architecture for Blueprint System

### 1. UI Architecture Overview

#### 1.1 Frontend Technology Stack

**Vue 3 Composition API with TypeScript**
```typescript
// src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import { createI18n } from 'vue-i18n';
import { createHead } from '@vueuse/head';
import { createVuetify } from 'vuetify';
import { apolloClient } from '@/plugins/apollo';
import { supabase } from '@/plugins/supabase';

import App from '@/App.vue';
import routes from '@/router/routes';
import messages from '@/locales';

import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';

const app = createApp(App);

// Initialize plugins
const pinia = createPinia();
const router = createRouter({
  history: createWebHistory(),
  routes
});

const i18n = createI18n({
  locale: 'en',
  fallbackLocale: 'en',
  messages
});

const head = createHead();

const vuetify = createVuetify({
  theme: {
    themes: {
      light: {
        colors: {
          primary: '#1976D2',
          secondary: '#424242',
          accent: '#82B1FF',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FFC107'
        }
      }
    }
  }
});

// Register plugins
app.use(pinia);
app.use(router);
app.use(i18n);
app.use(head);
app.use(vuetify);

// Mount application
app.mount('#app');
```

#### 1.2 Component Structure

**Component Hierarchy**
```
src/
├── components/
│   ├── layout/
│   │   ├── AppHeader.vue
│   │   ├── AppSidebar.vue
│   │   ├── AppFooter.vue
│   │   └── Breadcrumbs.vue
│   ├── common/
│   │   ├── DataTable.vue
│   │   ├── FileTree.vue
│   │   ├── SearchInput.vue
│   │   ├── TenantSelector.vue
│   │   └── UserAvatar.vue
│   ├── file-explorer/
│   │   ├── FileExplorerContainer.vue
│   │   ├── FileList.vue
│   │   ├── FolderTree.vue
│   │   ├── FilePreview.vue
│   │   └── FileActions.vue
│   ├── classification/
│   │   ├── ClassificationPanel.vue
│   │   ├── TaxonomyTree.vue
│   │   ├── ClassificationHistory.vue
│   │   └── ConfidenceIndicator.vue
│   └── provenance/
│       ├── ProvenanceTimeline.vue
│       ├── CommitHistory.vue
│       └── AuditTrail.vue
├── composables/
│   ├── useAuth.ts
│   ├── useFileService.ts
│   ├── useClassificationService.ts
│   ├── useSourceManagement.ts
│   └── useProvenanceService.ts
├── views/
│   ├── Dashboard.vue
│   ├── FileExplorer.vue
│   ├── Classification.vue
│   ├── Provenance.vue
│   └── Settings.vue
└── stores/
    ├── authStore.ts
    ├── fileStore.ts
    ├── sourceStore.ts
    └── classificationStore.ts
```

### 2. Core UI Components

#### 2.1 File Explorer Container

**FileExplorerContainer.vue Implementation**
```vue
<template>
  <div class="file-explorer-container">
    <v-row>
      <v-col cols="12" md="3">
        <folder-tree 
          :folders="folders" 
          :loading="loadingFolders"
          @folder-selected="handleFolderSelected"
          @refresh="loadFolders"
        />
      </v-col>
      
      <v-col cols="12" md="9">
        <v-card>
          <v-card-title class="d-flex align-center">
            <span>{{ currentFolderName }}</span>
            <v-spacer></v-spacer>
            <search-input 
              v-model="searchQuery" 
              @search="handleSearch"
              placeholder="Search files..."
            />
            <file-actions 
              :selected-files="selectedFiles"
              @refresh="loadFiles"
              @classify="classifySelectedFiles"
            />
          </v-card-title>
          
          <v-card-text>
            <file-list 
              :files="filteredFiles" 
              :loading="loadingFiles"
              v-model:selected="selectedFiles"
              @file-preview="showFilePreview"
              @file-classify="classifyFile"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    
    <file-preview 
      :file="previewFile"
      :visible="previewVisible"
      @close="previewVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useFileService } from '@/composables/useFileService';
import { useSourceManagement } from '@/composables/useSourceManagement';
import FolderTree from '@/components/file-explorer/FolderTree.vue';
import FileList from '@/components/file-explorer/FileList.vue';
import FilePreview from '@/components/file-explorer/FilePreview.vue';
import FileActions from '@/components/file-explorer/FileActions.vue';
import SearchInput from '@/components/common/SearchInput.vue';

const { activeSource } = useSourceManagement();
const { 
  folders, 
  files, 
  loadingFolders, 
  loadingFiles, 
  loadFolders, 
  loadFiles, 
  classifyFile,
  classifySelectedFiles
} = useFileService();

const selectedFiles = ref<any[]>([]);
const previewFile = ref<any>(null);
const previewVisible = ref(false);
const searchQuery = ref('');

// Load folders when component mounts or source changes
onMounted(() => {
  if (activeSource.value) {
    loadFolders(activeSource.value.id);
  }
});

watch(activeSource, (newSource) => {
  if (newSource) {
    loadFolders(newSource.id);
    selectedFiles.value = [];
  }
});

const currentFolderName = computed(() => {
  return activeSource.value?.name || 'File Explorer';
});

const filteredFiles = computed(() => {
  if (!searchQuery.value) {
    return files.value;
  }
  
  return files.value.filter(file => 
    file.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    file.path.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});

const handleFolderSelected = (folderPath: string) => {
  if (activeSource.value) {
    loadFiles(activeSource.value.id, folderPath);
  }
};

const handleSearch = (query: string) => {
  searchQuery.value = query;
};

const showFilePreview = (file: any) => {
  previewFile.value = file;
  previewVisible.value = true;
};
</script>

<style scoped>
.file-explorer-container {
  padding: 16px;
}
</style>
```

#### 2.2 File List Component

**FileList.vue Implementation**
```vue
<template>
  <div class="file-list">
    <v-data-table
      v-model="selected"
      :headers="headers"
      :items="files"
      :loading="loading"
      item-value="id"
      show-select
      class="elevation-1"
      :items-per-page="25"
    >
      <template v-slot:item.name="{ item }">
        <div class="d-flex align-center">
          <v-icon :icon="getFileIcon(item.type)" class="mr-2"></v-icon>
          <span>{{ item.name }}</span>
        </div>
      </template>
      
      <template v-slot:item.size="{ item }">
        <span>{{ formatFileSize(item.size) }}</span>
      </template>
      
      <template v-slot:item.modified="{ item }">
        <span>{{ formatDate(item.modified) }}</span>
      </template>
      
      <template v-slot:item.classification="{ item }">
        <v-chip 
          :color="getClassificationColor(item.classification)"
          :text="item.classification || 'Unclassified'"
          size="small"
        ></v-chip>
      </template>
      
      <template v-slot:item.confidence="{ item }">
        <confidence-indicator :value="item.confidence" />
      </template>
      
      <template v-slot:item.actions="{ item }">
        <v-btn 
          icon="mdi-eye" 
          size="small" 
          @click="$emit('file-preview', item)"
          title="Preview file"
        ></v-btn>
        <v-btn 
          icon="mdi-tag" 
          size="small" 
          @click="$emit('file-classify', item)"
          title="Classify file"
          :disabled="!item.content_extracted"
        ></v-btn>
      </template>
      
      <template v-slot:bottom>
        <div class="d-flex justify-space-between align-center pa-4">
          <div>
            <v-btn 
              color="primary" 
              @click="$emit('refresh')"
              :loading="loading"
            >
              Refresh
            </v-btn>
          </div>
          <div>
            <span>{{ files.length }} files</span>
          </div>
        </div>
      </template>
    </v-data-table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import ConfidenceIndicator from '@/components/classification/ConfidenceIndicator.vue';

interface FileItem {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  modified: string;
  classification?: string;
  confidence?: number;
  content_extracted: boolean;
}

const props = defineProps<{
  files: FileItem[];
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'file-preview', file: FileItem): void;
  (e: 'file-classify', file: FileItem): void;
  (e: 'refresh'): void;
}>();

const selected = defineModel<any[]>('selected', { default: [] });

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Size', key: 'size' },
  { title: 'Modified', key: 'modified' },
  { title: 'Classification', key: 'classification' },
  { title: 'Confidence', key: 'confidence' },
  { title: 'Actions', key: 'actions', sortable: false }
];

const getFileIcon = (fileType: string) => {
  const iconMap: Record<string, string> = {
    'folder': 'mdi-folder',
    'document': 'mdi-file-document',
    'image': 'mdi-file-image',
    'video': 'mdi-file-video',
    'audio': 'mdi-file-music',
    'spreadsheet': 'mdi-file-excel',
    'presentation': 'mdi-file-powerpoint',
    'pdf': 'mdi-file-pdf',
    'archive': 'mdi-file-zip',
    'code': 'mdi-file-code'
  };
  
  return iconMap[fileType] || 'mdi-file';
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

const getClassificationColor = (classification?: string) => {
  if (!classification) return 'grey';
  
  const colorMap: Record<string, string> = {
    'Financial': 'green',
    'Legal': 'blue',
    'HR': 'orange',
    'Technical': 'purple',
    'Marketing': 'pink',
    'Operations': 'cyan'
  };
  
  return colorMap[classification] || 'grey';
};
</script>
```

#### 2.3 Classification Panel

**ClassificationPanel.vue Implementation**
```vue
<template>
  <div class="classification-panel">
    <v-card>
      <v-card-title>File Classification</v-card-title>
      
      <v-card-text v-if="file">
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="file.name"
              label="File Name"
              readonly
            ></v-text-field>
          </v-col>
          
          <v-col cols="12">
            <v-textarea
              v-model="file.content"
              label="File Content"
              readonly
              rows="10"
            ></v-textarea>
          </v-col>
          
          <v-col cols="12">
            <taxonomy-tree
              :taxonomy="taxonomy"
              :selected="selectedClassification"
              @select="handleClassificationSelect"
            />
          </v-col>
          
          <v-col cols="12">
            <confidence-indicator 
              :value="confidence" 
              @update:value="confidence = $event"
            />
          </v-col>
          
          <v-col cols="12">
            <v-textarea
              v-model="classificationNotes"
              label="Classification Notes"
              placeholder="Add any notes about this classification..."
              rows="3"
            ></v-textarea>
          </v-col>
        </v-row>
      </v-card-text>
      
      <v-card-actions>
        <v-btn 
          color="primary" 
          @click="saveClassification"
          :disabled="!selectedClassification || !file"
          :loading="saving"
        >
          Save Classification
        </v-btn>
        <v-btn 
          color="secondary" 
          @click="autoClassify"
          :disabled="!file"
          :loading="classifying"
        >
          Auto-Classify
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useClassificationService } from '@/composables/useClassificationService';
import TaxonomyTree from '@/components/classification/TaxonomyTree.vue';
import ConfidenceIndicator from '@/components/classification/ConfidenceIndicator.vue';

interface File {
  id: string;
  name: string;
  content: string;
  path: string;
}

const props = defineProps<{
  file?: File;
}>();

const emit = defineEmits<{
  (e: 'classified', file: File): void;
}>();

const { taxonomy, classifyContent, autoClassifyContent } = useClassificationService();

const selectedClassification = ref<string>('');
const confidence = ref<number>(0.8);
const classificationNotes = ref<string>('');
const saving = ref(false);
const classifying = ref(false);

const handleClassificationSelect = (classification: string) => {
  selectedClassification.value = classification;
};

const saveClassification = async () => {
  if (!props.file || !selectedClassification.value) return;
  
  saving.value = true;
  
  try {
    await classifyContent(
      props.file.id,
      selectedClassification.value,
      confidence.value,
      classificationNotes.value
    );
    
    emit('classified', props.file);
  } catch (error) {
    console.error('Failed to save classification:', error);
  } finally {
    saving.value = false;
  }
};

const autoClassify = async () => {
  if (!props.file) return;
  
  classifying.value = true;
  
  try {
    const result = await autoClassifyContent(props.file.id);
    selectedClassification.value = result.classification;
    confidence.value = result.confidence;
    classificationNotes.value = result.notes || '';
  } catch (error) {
    console.error('Failed to auto-classify:', error);
  } finally {
    classifying.value = false;
  }
};

watch(() => props.file, () => {
  selectedClassification.value = '';
  confidence.value = 0.8;
  classificationNotes.value = '';
});
</script>
```

### 3. UI Composables

#### 3.1 File Service Composable

**useFileService.ts Implementation**
```typescript
import { ref, computed } from 'vue';
import { useQuery, useMutation } from '@vue/apollo-composable';
import { supabase } from '@/plugins/supabase';
import gql from 'graphql-tag';
import { useFileStore } from '@/stores/fileStore';

export function useFileService() {
  const fileStore = useFileStore();
  
  // Reactive state
  const folders = ref<any[]>([]);
  const files = ref<any[]>([]);
  const loadingFolders = ref(false);
  const loadingFiles = ref(false);
  
  // Supabase realtime subscriptions
  const fileChannel = ref<any>(null);
  const folderChannel = ref<any>(null);
  
  // GraphQL queries
  const GET_FOLDERS = gql`
    query GetFolders($sourceId: String!) {
      folders(sourceId: $sourceId) {
        id
        name
        path
        type
        modified
      }
    }
  `;
  
  const GET_FILES = gql`
    query GetFiles($sourceId: String!, $folderPath: String!) {
      files(sourceId: $sourceId, folderPath: $folderPath) {
        id
        name
        path
        type
        size
        modified
        classification
        confidence
        content_extracted
      }
    }
  `;
  
  const CLASSIFY_FILE = gql`
    mutation ClassifyFile($fileId: String!, $classification: String!, $confidence: Float!, $notes: String) {
      classifyFile(fileId: $fileId, classification: $classification, confidence: $confidence, notes: $notes) {
        id
        classification
        confidence
        classification_notes
      }
    }
  `;
  
  // Load folders for a source
  const loadFolders = async (sourceId: string) => {
    loadingFolders.value = true;
    
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('source_id', sourceId);
      
      if (error) throw error;
      
      folders.value = data || [];
      fileStore.setFolders(data || []);
    } catch (error) {
      console.error('Failed to load folders:', error);
    } finally {
      loadingFolders.value = false;
    }
  };
  
  // Load files in a folder
  const loadFiles = async (sourceId: string, folderPath: string) => {
    loadingFiles.value = true;
    
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('source_id', sourceId)
        .eq('folder_path', folderPath);
      
      if (error) throw error;
      
      files.value = data || [];
      fileStore.setFiles(data || []);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      loadingFiles.value = false;
    }
  };
  
  // Classify a single file
  const classifyFile = async (fileId: string, classification: string, confidence: number, notes?: string) => {
    try {
      const { data, error } = await supabase
        .from('files')
        .update({
          classification,
          confidence,
          classification_notes: notes,
          classification_timestamp: new Date().toISOString()
        })
        .eq('id', fileId)
        .select();
      
      if (error) throw error;
      
      // Update local state
      const fileIndex = files.value.findIndex(f => f.id === fileId);
      if (fileIndex !== -1) {
        files.value[fileIndex] = { ...files.value[fileIndex], ...data[0] };
      }
      
      return data[0];
    } catch (error) {
      console.error('Failed to classify file:', error);
      throw error;
    }
  };
  
  // Classify multiple files
  const classifySelectedFiles = async (fileIds: string[], classification: string, confidence: number, notes?: string) => {
    try {
      const { data, error } = await supabase
        .from('files')
        .update({
          classification,
          confidence,
          classification_notes: notes,
          classification_timestamp: new Date().toISOString()
        })
        .in('id', fileIds)
        .select();
      
      if (error) throw error;
      
      // Update local state
      data.forEach(updatedFile => {
        const fileIndex = files.value.findIndex(f => f.id === updatedFile.id);
        if (fileIndex !== -1) {
          files.value[fileIndex] = updatedFile;
        }
      });
      
      return data;
    } catch (error) {
      console.error('Failed to classify selected files:', error);
      throw error;
    }
  };
  
  // Subscribe to file changes
  const subscribeToFiles = (sourceId: string) => {
    fileChannel.value = supabase
      .channel('file-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'files',
          filter: `source_id=eq.${sourceId}`
        },
        (payload) => {
          // Add new file to local state
          files.value.push(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'files',
          filter: `source_id=eq.${sourceId}`
        },
        (payload) => {
          // Update file in local state
          const fileIndex = files.value.findIndex(f => f.id === payload.new.id);
          if (fileIndex !== -1) {
            files.value[fileIndex] = payload.new;
          }
        }
      )
      .subscribe();
  };
  
  // Subscribe to folder changes
  const subscribeToFolders = (sourceId: string) => {
    folderChannel.value = supabase
      .channel('folder-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'folders',
          filter: `source_id=eq.${sourceId}`
        },
        (payload) => {
          // Add new folder to local state
          folders.value.push(payload.new);
        }
      )
      .subscribe();
  };
  
  // Unsubscribe from channels
  const unsubscribe = () => {
    if (fileChannel.value) {
      supabase.removeChannel(fileChannel.value);
      fileChannel.value = null;
    }
    
    if (folderChannel.value) {
      supabase.removeChannel(folderChannel.value);
      folderChannel.value = null;
    }
  };
  
  return {
    folders: computed(() => folders.value),
    files: computed(() => files.value),
    loadingFolders: computed(() => loadingFolders.value),
    loadingFiles: computed(() => loadingFiles.value),
    loadFolders,
    loadFiles,
    classifyFile,
    classifySelectedFiles,
    subscribeToFiles,
    subscribeToFolders,
    unsubscribe
  };
}
```

### 4. UI Stores

#### 4.1 File Store Implementation

**fileStore.ts Implementation**
```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useFileStore = defineStore('file', () => {
  // State
  const folders = ref<any[]>([]);
  const files = ref<any[]>([]);
  const currentFolder = ref<string>('');
  
  // Getters
  const getFolders = computed(() => folders.value);
  const getFiles = computed(() => files.value);
  const getCurrentFolder = computed(() => currentFolder.value);
  
  // Actions
  const setFolders = (newFolders: any[]) => {
    folders.value = newFolders;
  };
  
  const setFiles = (newFiles: any[]) => {
    files.value = newFiles;
  };
  
  const setCurrentFolder = (folderPath: string) => {
    currentFolder.value = folderPath;
  };
  
  const addFolder = (folder: any) => {
    folders.value.push(folder);
  };
  
  const addFile = (file: any) => {
    files.value.push(file);
  };
  
  const updateFile = (fileId: string, updates: any) => {
    const index = files.value.findIndex(f => f.id === fileId);
    if (index !== -1) {
      files.value[index] = { ...files.value[index], ...updates };
    }
  };
  
  const removeFile = (fileId: string) => {
    files.value = files.value.filter(f => f.id !== fileId);
  };
  
  return {
    folders,
    files,
    currentFolder,
    getFolders,
    getFiles,
    getCurrentFolder,
    setFolders,
    setFiles,
    setCurrentFolder,
    addFolder,
    addFile,
    updateFile,
    removeFile
  };
});
```

### 5. UI Routing

#### 5.1 Route Configuration

**routes.ts Implementation**
```typescript
import { RouteRecordRaw } from 'vue-router';
import Dashboard from '@/views/Dashboard.vue';
import FileExplorer from '@/views/FileExplorer.vue';
import Classification from '@/views/Classification.vue';
import Provenance from '@/views/Provenance.vue';
import Settings from '@/views/Settings.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/files',
    name: 'File Explorer',
    component: FileExplorer
  },
  {
    path: '/classification',
    name: 'Classification',
    component: Classification
  },
  {
    path: '/provenance',
    name: 'Provenance',
    component: Provenance
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings
  }
];

export default routes;
```

This UI Specifications implementation provides a comprehensive frontend architecture for the Blueprint system, including component structure, core UI components, composables for data management, state stores, and routing configuration. The design follows modern Vue 3 Composition API patterns with TypeScript for type safety and maintainability.
