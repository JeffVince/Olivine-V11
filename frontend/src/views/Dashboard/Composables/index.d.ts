import { Ref } from 'vue';
import { FileStats, ClassificationStats, ProvenanceStats, SystemHealthStatus, File, Commit } from './state';

declare module './useDashboard' {
  interface DashboardStats {
    fileStats: FileStats | null;
    classificationStats: ClassificationStats | null;
    provenanceStats: ProvenanceStats | null;
    systemHealth: SystemHealthStatus | null;
    recentFiles: File[];
    recentCommits: Commit[];
  }

  export function useDashboard(): {
    stats: DashboardStats;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
  };
}

export {};
