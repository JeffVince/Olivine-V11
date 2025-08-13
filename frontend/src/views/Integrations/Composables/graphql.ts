import { useQuery, useMutation } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import type { GetSourcesResult, CreateSourceResult, TriggerSyncResult } from './Interface'
import { integrations } from './state'
import { updateFromResult } from './data'

// GraphQL
export const GET_SOURCES = gql`
  query GetSources($organizationId: ID!) {
    getSources(organizationId: $organizationId) {
      id
      type
      name
      description
      active
      updatedAt
      config {
        rootFolder
        enableWebhooks
      }
    }
  }
`

export const CREATE_SOURCE = gql`
  mutation CreateSource($input: CreateSourceInput!) {
    createSource(input: $input) {
      id
      type
      name
      description
      active
      updatedAt
      config {
        rootFolder
        enableWebhooks
      }
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

export const { result, refetch } = useQuery<GetSourcesResult>(
  GET_SOURCES,
  () => ({
    organizationId: '12345'
  }),
  () => ({
    enabled: true,
    fetchPolicy: 'cache-and-network'
  })
)

export const { mutate: createSource } = useMutation<CreateSourceResult>(CREATE_SOURCE)
export const { mutate: triggerSyncMutation } = useMutation<TriggerSyncResult>(TRIGGER_SYNC)
