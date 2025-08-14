import { gql } from '@apollo/client/core';

export const DASHBOARD_STATS_QUERY = gql`
  query DashboardStats($orgId: ID!) {
    # File statistics - Updated to match backend schema
    fileStats: getFileStats(orgId: $orgId) {
      total
      byStatus
      byMimeType
    }
    
    # Get recent files - Using getFiles query
    recentFiles: getFiles(orgId: $orgId, limit: 10) {
      id
      name
      path
      size
      mimeType
      createdAt
      updatedAt
      classificationStatus
    }
    
    # Get sources for additional stats
    sources: getSources(orgId: $orgId) {
      id
      name
      type
      active
      updatedAt
    }
    
    # Note: The following fields are commented out as they don't have direct equivalents in the schema
    # classificationStats
    # provenanceStats
    # systemHealth
    # commits
  }
`;

export const DASHBOARD_PROJECTS_QUERY = gql`
  query DashboardProjects($orgId: ID!) {
    projects(orgId: $orgId) {
      id
      name
      status
      startDate
      endDate
      description
      stats {
        totalFiles
        totalSize
        lastUpdated
      }
    }
  }
`;

export const DASHBOARD_SOURCES_QUERY = gql`
  query DashboardSources($orgId: ID!) {
    sources(orgId: $orgId) {
      id
      name
      type
      status
      lastSynced
      stats {
        totalFiles
        totalSize
        lastUpdated
      }
    }
  }
`;
