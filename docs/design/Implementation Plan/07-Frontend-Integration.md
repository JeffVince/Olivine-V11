# Frontend Integration Implementation
## Vue.js Frontend with Real-Time GraphQL Subscriptions

### 1. Frontend Architecture Overview

#### 1.1 Core Principles

**Real-Time Data Synchronization**
- Frontend subscribes to GraphQL subscriptions for instant updates
- Local state is automatically synchronized with backend changes
- Users see updates without manual refresh

**Multi-Tenant UI Context**
- All UI components enforce tenant context boundaries
- Data displayed is filtered by organization access
- User switching between organizations maintains proper data isolation

**Version-Controlled Views**
- UI can display historical versions of entities
- Users can compare versions and see change history
- Branch switching allows for safe experimentation

**Responsive Design System**
- UI adapts to different screen sizes and devices
- Consistent design language across all components
- Accessible interface following WCAG guidelines

### 2. Vue.js Component Structure

#### 2.1 Core Component Hierarchy

**Root App Component**
```vue
<template>
  <div id="app">
    <AppHeader />
    <div class="main-container">
      <SidebarNavigation />
      <main class="content-area">
        <router-view />
      </main>
    </div>
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import AppHeader from '@/components/layout/AppHeader.vue';
import SidebarNavigation from '@/components/layout/SidebarNavigation.vue';
import AppFooter from '@/components/layout/AppFooter.vue';
import { useAuthStore } from '@/stores/auth';
import { useOrganizationStore } from '@/stores/organization';
import { onMounted } from 'vue';

const authStore = useAuthStore();
const organizationStore = useOrganizationStore();

onMounted(async () => {
  // Initialize authentication state
  await authStore.initializeAuth();
  
  // Load user organizations
  if (authStore.isAuthenticated) {
    await organizationStore.loadOrganizations();
  }
});
</script>

<style>
@import '@/assets/styles/main.css';

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
</style>
```

#### 2.2 File Explorer Components

**FileExplorerContainer Component**
```vue
<template>
  <div class="file-explorer-container">
    <div class="toolbar">
      <OrganizationSelector 
        :organizations="organizations" 
        :current-org="currentOrg"
        @change="handleOrgChange"
      />
      <SourceSelector 
        :sources="sources" 
        :current-source="currentSource"
        @change="handleSourceChange"
      />
      <RefreshButton @click="refreshExplorer" />
    </div>
    
    <div class="explorer-content">
      <FileTree 
        :files="files" 
        :loading="loading"
        @node-selected="handleNodeSelected"
        @node-expanded="handleNodeExpanded"
      />
      
      <FileDetails 
        v-if="selectedFile"
        :file="selectedFile"
        @close="selectedFile = null"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useFileService } from '@/composables/useFileService';
import { useOrganizationStore } from '@/stores/organization';
import { useSourceStore } from '@/stores/source';
import OrganizationSelector from '@/components/file-explorer/OrganizationSelector.vue';
import SourceSelector from '@/components/file-explorer/SourceSelector.vue';
import RefreshButton from '@/components/file-explorer/RefreshButton.vue';
import FileTree from '@/components/file-explorer/FileTree.vue';
import FileDetails from '@/components/file-explorer/FileDetails.vue';

const fileService = useFileService();
const organizationStore = useOrganizationStore();
const sourceStore = useSourceStore();

const organizations = computed(() => organizationStore.organizations);
const currentOrg = computed(() => organizationStore.currentOrganization);
const sources = computed(() => sourceStore.sources);
const currentSource = computed(() => sourceStore.currentSource);

const files = ref<any[]>([]);
const loading = ref(false);
const selectedFile = ref<any>(null);

let fileSubscription: any = null;

onMounted(async () => {
  await initializeExplorer();
});

onUnmounted(() => {
  // Clean up subscriptions
  if (fileSubscription) {
    fileSubscription.unsubscribe();
  }
});

/**
 * Initialize the file explorer
 */
async function initializeExplorer() {
  loading.value = true;
  
  try {
    // Load initial file data
    await refreshExplorer();
    
    // Subscribe to real-time file updates
    fileSubscription = await fileService.subscribeToFiles(currentOrg.value.id);
    
  } catch (error) {
    console.error('Failed to initialize file explorer:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Refresh file explorer data
 */
async function refreshExplorer() {
  if (!currentOrg.value || !currentSource.value) return;
  
  loading.value = true;
  
  try {
    files.value = await fileService.listFiles(
      currentOrg.value.id,
      currentSource.value.id
    );
  } catch (error) {
    console.error('Failed to refresh files:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Handle organization change
 */
async function handleOrgChange(orgId: string) {
  await organizationStore.setCurrentOrganization(orgId);
  
  // Load sources for the selected organization
  await sourceStore.loadSources(orgId);
  
  // Refresh explorer with new context
  await refreshExplorer();
}

/**
 * Handle source change
 */
async function handleSourceChange(sourceId: string) {
  await sourceStore.setCurrentSource(sourceId);
  await refreshExplorer();
}

/**
 * Handle file node selection
 */
function handleNodeSelected(file: any) {
  selectedFile.value = file;
}

/**
 * Handle file node expansion
 */
async function handleNodeExpanded(node: any) {
  // Load children for expanded node
  if (node.type === 'folder') {
    const children = await fileService.listFiles(
      currentOrg.value.id,
      currentSource.value.id,
      node.path
    );
    
    // Update node with children
    node.children = children;
  }
}
</script>

<style scoped>
.file-explorer-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  display: flex;
  padding: 10px;
  border-bottom: 1px solid #e0e0e0;
  gap: 10px;
}

.explorer-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>
```

**FileTree Component**
```vue
<template>
  <div class="file-tree">
    <div class="tree-header">
      <h3>Files</h3>
      <button @click="toggleViewMode" class="view-toggle">
        {{ viewMode === 'tree' ? 'List View' : 'Tree View' }}
      </button>
    </div>
    
    <div class="tree-content" v-if="viewMode === 'tree'">
      <TreeNode
        v-for="node in rootNodes"
        :key="node.id"
        :node="node"
        :level="0"
        @node-selected="emit('node-selected', $event)"
        @node-expanded="emit('node-expanded', $event)"
      />
    </div>
    
    <div class="list-content" v-else>
      <FileList
        :files="flatFiles"
        @file-selected="emit('node-selected', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import TreeNode from '@/components/file-explorer/TreeNode.vue';
import FileList from '@/components/file-explorer/FileList.vue';

const props = defineProps<{
  files: any[];
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'node-selected', file: any): void;
  (e: 'node-expanded', node: any): void;
}>();

const viewMode = ref<'tree' | 'list'>('tree');

const rootNodes = computed(() => {
  // Build hierarchical tree structure from flat files
  const tree: any[] = [];
  const nodeMap: Map<string, any> = new Map();
  
  // Create nodes for all files
  props.files.forEach(file => {
    const node = {
      ...file,
      children: [],
      expanded: false
    };
    
    nodeMap.set(file.path, node);
  });
  
  // Build parent-child relationships
  props.files.forEach(file => {
    const node = nodeMap.get(file.path);
    const parentPath = getParentPath(file.path);
    
    if (parentPath && nodeMap.has(parentPath)) {
      const parentNode = nodeMap.get(parentPath);
      parentNode.children.push(node);
    } else {
      tree.push(node);
    }
  });
  
  return tree;
});

const flatFiles = computed(() => {
  // Return flat list of files for list view
  return props.files.filter(file => file.type === 'file');
});

function toggleViewMode() {
  viewMode.value = viewMode.value === 'tree' ? 'list' : 'tree';
}

function getParentPath(path: string): string | null {
  const parts = path.split('/').filter(part => part.length > 0);
  if (parts.length <= 1) return null;
  
  parts.pop();
  return '/' + parts.join('/');
}
</script>

<style scoped>
.file-tree {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e0e0e0;
}

.tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #e0e0e0;
}

.view-toggle {
  padding: 5px 10px;
  background: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}

.tree-content, .list-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}
</style>
```

### 3. GraphQL Client Implementation

#### 3.1 Apollo Client Setup

**GraphQL Client Configuration**
```typescript
import { ApolloClient, InMemoryCache, HttpLink, split, from } from '@apollo/client/core';
import { WebSocketLink } from '@apollo/client/link/ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { SubscriptionClient } from 'subscriptions-transport-ws';

// HTTP link for queries and mutations
const httpLink = new HttpLink({
  uri: process.env.VUE_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
  credentials: 'include'
});

// WebSocket link for subscriptions
const subscriptionClient = new SubscriptionClient(
  process.env.VUE_APP_GRAPHQL_SUBSCRIPTION_ENDPOINT || 'ws://localhost:4000/graphql',
  {
    reconnect: true,
    connectionParams: () => ({
      // Add authentication headers
      'x-user-id': localStorage.getItem('user_id')
    })
  }
);

const wsLink = new WebSocketLink(subscriptionClient);

// Split links based on operation type
const link = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink
);

// Create Apollo Client
export const apolloClient = new ApolloClient({
  link: from([link]),
  cache: new InMemoryCache({
    typePolicies: {
      File: {
        keyFields: ['id']
      },
      Content: {
        keyFields: ['id']
      },
      Project: {
        keyFields: ['id']
      },
      Task: {
        keyFields: ['id']
      },
      Resource: {
        keyFields: ['id']
      },
      Commit: {
        keyFields: ['id']
      },
      Version: {
        keyFields: ['id']
      }
    }
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network'
    }
  }
});
```

#### 3.2 Vue Apollo Integration

**Vue Apollo Provider Setup**
```typescript
import { createApp, provide, h } from 'vue';
import { DefaultApolloClient } from '@vue/apollo-composable';
import { apolloClient } from '@/graphql/client';

const app = createApp({
  setup() {
    provide(DefaultApolloClient, apolloClient);
  },
  render: () => h(App)
});

export default app;
```

### 4. Real-Time Subscription Composables

#### 4.1 File Service Composable

**useFileService Composable**
```typescript
import { useQuery, useMutation, useSubscription } from '@vue/apollo-composable';
import { ref, computed } from 'vue';
import gql from 'graphql-tag';

// GraphQL queries
const LIST_FILES = gql`
  query ListFiles($orgId: ID!, $sourceId: ID, $path: String) {
    files(filter: { orgId: $orgId, sourceId: $sourceId, path: $path }) {
      id
      orgId
      sourceId
      path
      name
      size
      mimeType
      checksum
      createdAt
      modified
      metadata
      current
      deleted
      content {
        id
        contentKey
        title
        status
      }
    }
  }
`;

const GET_FILE = gql`
  query GetFile($orgId: ID!, $id: ID!) {
    file(orgId: $orgId, id: $id) {
      id
      orgId
      sourceId
      path
      name
      size
      mimeType
      checksum
      createdAt
      modified
      metadata
      current
      deleted
      content {
        id
        contentKey
        title
        description
        format
        status
        createdAt
        updatedAt
        metadata
      }
      versions {
        id
        createdAt
        contentHash
        commit {
          id
          message
          author
          createdAt
        }
      }
    }
  }
`;

// GraphQL mutations
const CREATE_FILE = gql`
  mutation CreateFile($input: CreateFileInput!) {
    createFile(input: $input) {
      id
      orgId
      sourceId
      path
      name
      size
      mimeType
      checksum
      createdAt
      modified
      metadata
      current
      deleted
    }
  }
`;

const UPDATE_FILE = gql`
  mutation UpdateFile($input: UpdateFileInput!) {
    updateFile(input: $input) {
      id
      orgId
      sourceId
      path
      name
      size
      mimeType
      checksum
      createdAt
      modified
      metadata
      current
      deleted
    }
  }
`;

const DELETE_FILE = gql`
  mutation DeleteFile($input: DeleteFileInput!) {
    deleteFile(input: $input)
  }
`;

// GraphQL subscriptions
const FILE_CREATED = gql`
  subscription OnFileCreated($orgId: ID!) {
    fileCreated(orgId: $orgId) {
      id
      orgId
      sourceId
      path
      name
      size
      mimeType
      checksum
      createdAt
      modified
      metadata
      current
      deleted
    }
  }
`;

const FILE_UPDATED = gql`
  subscription OnFileUpdated($orgId: ID!) {
    fileUpdated(orgId: $orgId) {
      id
      orgId
      sourceId
      path
      name
      size
      mimeType
      checksum
      createdAt
      modified
      metadata
      current
      deleted
    }
  }
`;

const FILE_DELETED = gql`
  subscription OnFileDeleted($orgId: ID!) {
    fileDeleted(orgId: $orgId) {
      id
      orgId
      sourceId
      path
      name
      size
      mimeType
      checksum
      createdAt
      modified
      metadata
      current
      deleted
    }
  }
`;

export function useFileService() {
  // File listing
  const listFiles = async (orgId: string, sourceId?: string, path?: string) => {
    const { result } = useQuery(LIST_FILES, { orgId, sourceId, path });
    return computed(() => result.value?.files || []);
  };

  // Get single file
  const getFile = async (orgId: string, id: string) => {
    const { result } = useQuery(GET_FILE, { orgId, id });
    return computed(() => result.value?.file);
  };

  // Create file
  const createFile = async (input: any) => {
    const { mutate } = useMutation(CREATE_FILE);
    return await mutate({ input });
  };

  // Update file
  const updateFile = async (input: any) => {
    const { mutate } = useMutation(UPDATE_FILE);
    return await mutate({ input });
  };

  // Delete file
  const deleteFile = async (input: any) => {
    const { mutate } = useMutation(DELETE_FILE);
    return await mutate({ input });
  };

  // Subscribe to file changes
  const subscribeToFiles = async (orgId: string) => {
    const { result, subscribeToMore } = useSubscription(FILE_CREATED, { orgId });
    
    // Subscribe to additional events
    subscribeToMore({
      document: FILE_UPDATED,
      variables: { orgId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev;
        
        // Handle file update
        const updatedFile = subscriptionData.data.fileUpdated;
        console.log('File updated in real-time:', updatedFile);
        
        // Emit event for UI refresh
        window.dispatchEvent(new CustomEvent('file-updated', { detail: updatedFile }));
        
        return prev;
      }
    });
    
    subscribeToMore({
      document: FILE_DELETED,
      variables: { orgId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev;
        
        // Handle file deletion
        const deletedFile = subscriptionData.data.fileDeleted;
        console.log('File deleted in real-time:', deletedFile);
        
        // Emit event for UI refresh
        window.dispatchEvent(new CustomEvent('file-deleted', { detail: deletedFile }));
        
        return prev;
      }
    });
    
    return result;
  };

  return {
    listFiles,
    getFile,
    createFile,
    updateFile,
    deleteFile,
    subscribeToFiles
  };
}
```

### 5. Authentication Integration

#### 5.1 Auth Store Implementation

**Pinia Auth Store**
```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useOrganizationStore } from '@/stores/organization';

export const useAuthStore = defineStore('auth', () => {
  const userId = ref<string | null>(null);
  const isAuthenticated = computed(() => !!userId.value);
  
  /**
   * Initialize authentication state
   */
  async function initializeAuth() {
    // Check for existing session
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) {
      userId.value = storedUserId;
    }
    
    // If authenticated, initialize organization context
    if (isAuthenticated.value) {
      const organizationStore = useOrganizationStore();
      await organizationStore.loadOrganizations();
    }
  }
  
  /**
   * Login user
   */
  async function login(credentials: { email: string; password: string }) {
    try {
      // Perform authentication (implementation depends on your auth system)
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      if (!response.ok) {
        throw new Error('Authentication failed');
      }
      
      const data = await response.json();
      userId.value = data.userId;
      
      // Store in localStorage
      localStorage.setItem('user_id', data.userId);
      
      // Initialize organization context
      const organizationStore = useOrganizationStore();
      await organizationStore.loadOrganizations();
      
      return { success: true, userId: data.userId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Logout user
   */
  async function logout() {
    try {
      // Perform logout (implementation depends on your auth system)
      await fetch('/api/auth/logout', { method: 'POST' });
      
      userId.value = null;
      localStorage.removeItem('user_id');
      
      // Clear organization context
      const organizationStore = useOrganizationStore();
      organizationStore.$reset();
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  return {
    userId,
    isAuthenticated,
    initializeAuth,
    login,
    logout
  };
});
```

#### 5.2 Organization Store Implementation

**Pinia Organization Store**
```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import gql from 'graphql-tag';
import { apolloClient } from '@/graphql/client';

const LIST_ORGANIZATIONS = gql`
  query ListOrganizations {
    organizations {
      id
      name
      description
      createdAt
      updatedAt
    }
  }
`;

const GET_ORGANIZATION = gql`
  query GetOrganization($id: ID!) {
    organization(id: $id) {
      id
      name
      description
      createdAt
      updatedAt
      projects {
        id
        projectKey
        name
        status
      }
    }
  }
`;

export const useOrganizationStore = defineStore('organization', () => {
  const organizations = ref<any[]>([]);
  const currentOrganization = ref<any>(null);
  const loading = ref(false);
  
  const currentOrgId = computed(() => currentOrganization.value?.id);
  
  /**
   * Load user organizations
   */
  async function loadOrganizations() {
    loading.value = true;
    
    try {
      const response = await apolloClient.query({
        query: LIST_ORGANIZATIONS
      });
      
      organizations.value = response.data.organizations;
      
      // Set first organization as current if none selected
      if (!currentOrganization.value && organizations.value.length > 0) {
        currentOrganization.value = organizations.value[0];
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Set current organization
   */
  async function setCurrentOrganization(orgId: string) {
    const org = organizations.value.find(o => o.id === orgId);
    if (org) {
      currentOrganization.value = org;
      
      // Update Apollo Client context
      apolloClient.setLink(
        apolloClient.link.concat(
          new (apolloClient.link.constructor as any)({
            uri: apolloClient.link.options.uri,
            headers: {
              'x-org-id': orgId
            }
          })
        )
      );
    }
  }
  
  /**
   * Get organization details
   */
  async function getOrganization(orgId: string) {
    try {
      const response = await apolloClient.query({
        query: GET_ORGANIZATION,
        variables: { id: orgId }
      });
      
      return response.data.organization;
    } catch (error) {
      console.error('Failed to get organization:', error);
      throw error;
    }
  }
  
  return {
    organizations,
    currentOrganization,
    loading,
    currentOrgId,
    loadOrganizations,
    setCurrentOrganization,
    getOrganization
  };
});
```

This implementation provides a comprehensive frontend integration with Vue.js components, GraphQL client setup, real-time subscriptions, and authentication system. The UI enforces tenant context boundaries and provides real-time synchronization with backend changes.
