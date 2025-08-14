import { ref, reactive } from 'vue';

// Type definitions
export interface FileTypeStats {
  type: string;
  count: number;
  size: number;
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  byType: FileTypeStats[];
}

export interface ClassificationStats {
  totalClassified: number;
  totalPending: number;
  totalFailed: number;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
}

export interface RecentActivity {
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
}

export interface ProvenanceStats {
  totalCommits: number;
  totalEntities: number;
  recentActivity: RecentActivity[];
}

export interface SystemHealthComponent {
  name: string;
  status: 'operational' | 'degraded' | 'outage';
  message: string;
}

export interface SystemHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastChecked: string;
  components: SystemHealthComponent[];
}

export interface File {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  modified: string;
  status: string;
}

export interface Commit {
  id: string;
  message: string;
  timestamp: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
}

export interface DashboardState {
  isLoading: boolean;
  error: Error | null;
  stats: {
    fileStats: FileStats | null;
    classificationStats: ClassificationStats | null;
    provenanceStats: ProvenanceStats | null;
    systemHealth: SystemHealthStatus | null;
    recentFiles: File[];
    recentCommits: Commit[];
  };
}

// State - Single source of truth for all reactive variables
const state = reactive<DashboardState>({
  isLoading: false,
  error: null,
  stats: {
    fileStats: null,
    classificationStats: null,
    provenanceStats: null,
    systemHealth: null,
    recentFiles: [],
    recentCommits: [],
  },
});

// State management functions
export function useDashboardState() {
  const setLoading = (isLoading: boolean) => {
    state.isLoading = isLoading;
  };

  const setError = (error: Error | null) => {
    state.error = error;
  };

  const setStats = (data: Partial<DashboardState['stats']>) => {
    Object.assign(state.stats, data);
  };

  return {
    state,
    setLoading,
    setError,
    setStats,
  };
}

export default state;
