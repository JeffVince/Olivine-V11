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
              <div class="text-h4 mb-2">{{ formatNumber(stats?.fileStats?.totalFiles || 0) }}</div>
              <div class="text-caption text-medium-emphasis">{{ formatBytes(stats?.fileStats?.totalSize || 0) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="4">
          <v-card class="stat-card">
            <v-card-title class="text-subtitle-1 font-weight-medium">Classifications</v-card-title>
            <v-card-text>
              <div class="text-h4 mb-2">{{ formatNumber(stats?.classificationStats?.totalClassified || 0) }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ stats?.classificationStats?.totalPending || 0 }} pending
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="4">
          <v-card class="stat-card">
            <v-card-title class="text-subtitle-1 font-weight-medium">System Health</v-card-title>
            <v-card-text>
              <v-chip
                :color="getHealthStatusColor(stats?.systemHealth?.status || '')"
                size="small"
                class="mb-2"
              >
                {{ stats?.systemHealth?.status || 'UNKNOWN' }}
              </v-chip>
              <div class="text-caption text-medium-emphasis">
                Last checked: {{ formatDate(stats?.systemHealth?.lastChecked) }}
              </div>
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
import { ref, onMounted } from 'vue';
import { useDashboard } from './Composables/useDashboard';
import DashboardHeader from './Components/DashboardHeader.vue';
import type { FileStats, ClassificationStats, ProvenanceStats, SystemHealthStatus, File, Commit } from './Composables/state';

interface DashboardStats {
  fileStats: FileStats | null;
  classificationStats: ClassificationStats | null;
  provenanceStats: ProvenanceStats | null;
  systemHealth: SystemHealthStatus | null;
  recentFiles: File[];
  recentCommits: Commit[];
}

const { 
  stats, 
  isLoading, 
  error, 
  refresh 
}: {
  stats: DashboardStats;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} = useDashboard();

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
