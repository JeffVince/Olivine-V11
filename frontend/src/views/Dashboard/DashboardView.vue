<template>
  <div class="dashboard-container">
    <!-- Loading State -->
    <v-overlay
      v-if="isLoading"
      :model-value="true"
      class="align-center justify-center"
    >
      <v-progress-circular
        indeterminate
        size="64"
      ></v-progress-circular>
      <div class="mt-4">Loading dashboard data...</div>
    </v-overlay>

    <!-- Error State -->
    <v-alert
      v-else-if="error"
      type="error"
      class="ma-4"
    >
      {{ error }}
      <v-btn
        color="error"
        variant="text"
        @click="refresh"
      >
        <v-icon start>mdi-refresh</v-icon>
        Retry
      </v-btn>
    </v-alert>

    <!-- Main Content -->
    <template v-else>
      <!-- Header -->
      <v-row>
        <v-col cols="12">
          <v-card class="glass-card mb-4">
            <DashboardHeader 
              :loading="isLoading"
              @create-project="handleCreateProject" 
              @refresh="refresh"
            />
          </v-card>
        </v-col>
      </v-row>

      <!-- Stats Overview -->
      <v-row class="mb-4">
        <v-col cols="12" md="4">
          <v-card class="stat-card">
            <v-card-title class="text-subtitle-1 font-weight-medium">Files</v-card-title>
            <v-card-text>
              <div class="text-h4 mb-2">{{ formatNumber(stats?.fileStats?.total || 0) }}</div>
              <div class="text-caption text-medium-emphasis">
                <span v-if="stats?.fileStats?.byStatus">
                  {{ stats.fileStats.byStatus.PROCESSED || 0 }} processed • 
                  {{ stats.fileStats.byStatus.PENDING || 0 }} pending
                </span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="4">
          <v-card class="stat-card">
            <v-card-title class="text-subtitle-1 font-weight-medium">File Types</v-card-title>
            <v-card-text>
              <div v-if="stats?.fileStats?.byMimeType" class="mb-2">
                <div v-for="(count, type) in stats.fileStats.byMimeType" :key="type" class="d-flex align-center mb-1">
                  <span class="text-caption text-truncate" style="width: 100px">{{ typeof type === 'string' ? type.split('/').pop() : type }}</span>
                  <v-spacer></v-spacer>
                  <span class="text-caption font-weight-medium">{{ count }}</span>
                </div>
              </div>
              <div v-else class="text-caption text-medium-emphasis">No file type data available</div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="4">
          <v-card class="stat-card">
            <v-card-title class="text-subtitle-1 font-weight-medium">Data Sources</v-card-title>
            <v-card-text>
              <div v-if="stats?.sources?.length" class="mb-2">
                <div v-for="source in stats.sources" :key="source.id" class="d-flex align-center mb-1">
                  <v-icon :icon="getSourceIcon(source.type)" size="small" class="mr-2"></v-icon>
                  <span class="text-caption">{{ source.name }}</span>
                  <v-spacer></v-spacer>
                  <v-icon
                    :color="source.active ? 'success' : 'error'"
                    size="x-small"
                    :icon="source.active ? 'mdi-check-circle' : 'mdi-close-circle'"
                  ></v-icon>
                </div>
              </div>
              <div v-else class="text-caption text-medium-emphasis">No data sources connected</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Recent Activity -->
      <v-row>
        <v-col cols="12" md="8">
          <v-card class="mb-4">
            <v-card-title>Recent Files</v-card-title>
            <v-card-text>
              <v-list v-if="stats?.recentFiles?.length">
                <v-list-item
                  v-for="file in stats.recentFiles.slice(0, 5)"
                  :key="file.id"
                  :title="file.name"
                  :subtitle="formatDate(file.modified)"
                >
                  <template v-slot:prepend>
                    <v-icon class="me-2">mdi-file-document-outline</v-icon>
                  </template>
                  <template v-slot:append>
                    <span class="text-caption text-medium-emphasis">
                      {{ formatBytes(file.size) }}
                    </span>
                  </template>
                </v-list-item>
              </v-list>
              <v-alert
                v-else
                type="info"
                variant="tonal"
              >
                No recent files found
              </v-alert>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="4">
          <v-card class="mb-4">
            <v-card-title>Recent Activity</v-card-title>
            <v-card-text>
              <v-timeline density="compact" align="start">
                <v-timeline-item
                  v-for="(commit, index) in stats?.recentCommits?.slice(0, 5) || []"
                  :key="index"
                  :dot-color="getCommitColor(index)"
                  size="small"
                >
                  <div class="text-caption">
                    {{ formatDate(commit.timestamp) }}
                  </div>
                  <div class="font-weight-medium">
                    {{ commit.message }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ commit.author.name }}
                  </div>
                </v-timeline-item>
              </v-timeline>
              <v-alert
                v-if="!stats?.recentCommits?.length"
                type="info"
                variant="tonal"
                class="mt-2"
              >
                No recent activity
              </v-alert>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useDashboard } from './Composables/useDashboard';
import DashboardHeader from './Components/DashboardHeader.vue';
import type { DashboardStats, FileStats, Source } from './Composables/useDashboard';

// Define local types for better type safety
interface LocalDashboardStats {
  fileStats: {
    total: number;
    byStatus: Record<string, number>;
    byMimeType: Record<string, number>;
  } | null;
  recentFiles: Array<{
    id: string;
    name: string;
    path: string;
    size: number | null;
    mimeType: string | null;
    createdAt: string;
    updatedAt: string;
    classificationStatus: string;
  }>;
  sources: Array<{
    id: string;
    name: string;
    type: string;
    active: boolean;
    updatedAt: string;
  }>;
}

const { 
  dashboardStats, 
  isLoading, 
  error, 
  refresh 
} = useDashboard();

// Create a computed property to handle the reactive dashboard stats
const stats = computed<LocalDashboardStats>(() => ({
  fileStats: dashboardStats.value?.fileStats || null,
  recentFiles: dashboardStats.value?.recentFiles || [],
  sources: dashboardStats.value?.sources || []
}));

// Refresh data when component is mounted
onMounted(() => {
  refresh();
});

// Format number with commas
const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Format bytes to human readable format
const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Format date
const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Get icon for source type
const getSourceIcon = (type: string): string => {
  switch (type.toLowerCase()) {
    case 'dropbox':
      return 'mdi-dropbox';
    case 'google-drive':
      return 'mdi-google-drive';
    case 'onedrive':
      return 'mdi-microsoft-onedrive';
    default:
      return 'mdi-folder';
  }
};

// Get color based on health status
const getHealthStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'healthy':
      return 'success';
    case 'degraded':
      return 'warning';
    case 'unhealthy':
      return 'error';
    default:
      return 'grey';
  }
};

// Get color for commit timeline items
const getCommitColor = (index: number): string => {
  const colors = ['primary', 'secondary', 'success', 'info', 'warning'];
  return colors[index % colors.length];
};

// Handle create project
const handleCreateProject = () => {
  // TODO: Implement create project logic
  console.log('Create project clicked');
};
</script>

<style scoped>
.dashboard-container {
  padding: 16px;
}

.glass-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.stat-card {
  height: 100%;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.v-timeline-item {
  min-height: 60px;
}
</style>
