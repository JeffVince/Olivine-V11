import { useQuery, useMutation } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import type { GetSourcesResult, CreateSourceResult, TriggerSyncResult } from './Interface'

// GraphQL
export const GET_SOURCES = gql`
  query GetSources($organizationId: ID!) {
    getSources(organizationId: $organizationId) {
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
  mutation CreateSource($input: CreateSourceInput!) {
    createSource(input: $input) {
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
  mutation TriggerSync($input: TriggerSyncInput!) {
    triggerSync(input: $input) {
      success
      message
    }
  }
`

// Export functions that create the queries when called within component context
export const useSourcesQuery = (organizationId: string) => {
  return useQuery<GetSourcesResult>(
    GET_SOURCES,
    () => ({
      organizationId
    }),
    () => ({
      enabled: !!organizationId,
      fetchPolicy: 'cache-and-network'
    })
  )
}

export const { mutate: createSource } = useMutation<CreateSourceResult>(CREATE_SOURCE)
export const { mutate: triggerSyncMutation } = useMutation<TriggerSyncResult>(TRIGGER_SYNC)
