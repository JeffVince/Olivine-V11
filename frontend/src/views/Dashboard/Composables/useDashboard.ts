import { computed, ref, watch } from 'vue';
import { useQuery } from '@vue/apollo-composable';
import type { ApolloQueryResult } from '@apollo/client';
import { DASHBOARD_STATS_QUERY } from './graphql';
import { useDashboardState } from './state';
import { useOrganizationStore } from '@/stores/organizationStore';

// Types
export interface FileStats {
  total: number;
  byStatus: Record<string, number>;
  byMimeType: Record<string, number>;
}

export interface FileMeta {
  id: string;
  name: string;
  path: string;
  size: number | null;
  mimeType: string | null;
  createdAt: string;
  updatedAt: string;
  classificationStatus: string;
}

export interface Source {
  id: string;
  name: string;
  type: string;
  active: boolean;
  updatedAt: string;
}

export interface DashboardStats {
  fileStats: FileStats | null;
  recentFiles: FileMeta[];
  sources: Source[];
}

interface UseDashboardReturn {
  dashboardStats: {
    value: DashboardStats;
  };
  isLoading: {
    value: boolean;
  };
  error: {
    value: string | null;
  };
  refresh: () => Promise<void>;
}

export function useDashboard(): UseDashboardReturn {
  // Initialize stores and state
  const organizationStore = useOrganizationStore();
  const { setLoading, setError, setStats } = useDashboardState();
  
  // Reactive state
  const dashboardStats = ref<DashboardStats>({
    fileStats: null,
    recentFiles: [],
    sources: []
  });
  
  const isLoading = ref(true);
  const error = ref<string | null>(null);
  const isRefreshing = ref(false);
  
  // Get organization ID
  const organizationId = computed(() => 
    organizationStore.currentOrg?.id || '00000000-0000-0000-0000-000000000000'
  );

  // GraphQL query
  const { refetch } = useQuery(
    DASHBOARD_STATS_QUERY,
    () => ({ orgId: organizationId.value }),
    { 
      fetchPolicy: 'cache-and-network',
      onResult: (result: ApolloQueryResult<{
    fileStats: any;
    recentFiles: any[];
    sources: any[];
  }>) => {
        if (result.data) {
          const { fileStats, recentFiles = [], sources = [] } = result.data;
          
          dashboardStats.value = {
            fileStats,
            recentFiles,
            sources
          };
          
          // Update global state
          setStats({
            fileStats,
            recentFiles,
            sources
          } as any); // Temporary type assertion to avoid type errors
        }
      },
      onError: (err: Error) => {
        const errorMessage = err.message || 'Failed to load dashboard data';
        error.value = errorMessage;
        setError(err);
      }
    }
  );

  // Watch for loading state changes
  watch(isLoading, (newVal: boolean) => {
    setLoading(newVal);
  });

  // Refresh function
  const refresh = async (): Promise<void> => {
    try {
      isRefreshing.value = true;
      await refetch();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh dashboard data';
      error.value = errorMessage;
      setError(new Error(errorMessage));
    } finally {
      isRefreshing.value = false;
    }
  };

  // Initial data load
  const loadInitialData = async (): Promise<void> => {
    try {
      isLoading.value = true;
      await refresh();
    } catch (err) {
      const errorMessage = 'Failed to load dashboard data';
      error.value = errorMessage;
      setError(new Error(errorMessage));
    } finally {
      isLoading.value = false;
    }
  };

  // Load data when composable is used
  loadInitialData();

  // Return the reactive state and methods
  // Create a proxy object that matches the expected return type
  const result = {
    get dashboardStats() {
      return { value: dashboardStats.value };
    },
    get isLoading() {
      return { value: isLoading.value };
    },
    get error() {
      return { value: error.value };
    },
    refresh
  };

  return result as unknown as UseDashboardReturn;
}

export default useDashboard;
