declare module '*.graphql' {
  import { DocumentNode } from 'graphql';
  const content: DocumentNode;
  export default content;
}

declare module '@apollo/client/core' {
  export * from '@apollo/client';
  export { gql } from '@apollo/client';
}

// Add type definitions for the GraphQL queries
declare module './graphql' {
  import { DocumentNode } from 'graphql';
  
  export const DASHBOARD_STATS_QUERY: DocumentNode;
  // Add other queries here as needed
}
