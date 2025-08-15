import { useQuery, useMutation } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import type { GetSourcesResult, CreateSourceResult, TriggerSyncResult } from './Interface'

// GraphQL
export const GET_SOURCES = gql`
  query GetSources($orgId: ID!) {
    getSources(orgId: $orgId) {
      id
      type
      name
      active
      updatedAt
      config
    }
  }
`

export const CREATE_SOURCE = gql`
  mutation CreateSource($orgId: ID!, $name: String!, $type: SourceType!, $config: JSON) {
    createSource(orgId: $orgId, name: $name, type: $type, config: $config) {
      id
      type
      name
      active
      updatedAt
      config
    }
  }
`

export const TRIGGER_SYNC = gql`
  mutation TriggerSourceResync($orgId: ID!, $sourceId: ID!) {
    triggerSourceResync(orgId: $orgId, sourceId: $sourceId)
  }
`

export const DELETE_SOURCE = gql`
  mutation DeleteSource($orgId: ID!, $sourceId: ID!) {
    deleteSource(orgId: $orgId, sourceId: $sourceId)
  }
`

// Export functions that create the queries when called within component context
export const useSourcesQuery = (orgId: string) => {
  return useQuery<GetSourcesResult>(
    GET_SOURCES,
    () => ({
      orgId
    }),
    () => ({
      enabled: !!orgId,
      fetchPolicy: 'cache-and-network'
    })
  )
}

// IMPORTANT: Do not call useMutation at module top-level.
// These factory functions must be invoked from within a component setup() or an active instance context.
export const useCreateSourceMutation = () => useMutation<CreateSourceResult>(CREATE_SOURCE)
export const useTriggerSyncMutation = () => useMutation<TriggerSyncResult>(TRIGGER_SYNC)
export const useDeleteSourceMutation = () => useMutation(DELETE_SOURCE)
