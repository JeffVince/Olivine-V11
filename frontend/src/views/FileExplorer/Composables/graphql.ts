import { useMutation } from '@vue/apollo-composable'
import gql from 'graphql-tag'

export function useFileExplorerMutations() {
  const REPROCESS_MUTATION = gql`
    mutation TriggerFileReprocessing($fileId: ID!, $orgId: ID!) {
      triggerFileReprocessing(fileId: $fileId, orgId: $orgId)
    }
  `
  
  const CLASSIFY_MUTATION = gql`
    mutation ClassifyFile($input: ClassifyFileInput!) {
      classifyFile(input: $input) {
        id
        classificationStatus
        classificationConfidence
        canonicalSlot
        updatedAt
      }
    }
  `
  
  const TRIGGER_FULL_SYNC = gql`
    mutation TriggerFullSync($orgId: ID!) { 
      triggerFullSync(orgId: $orgId) 
    }
  `
  
  const CANONICAL_SLOTS_QUERY = gql`
    query CanonicalSlots($orgId: ID!) {
      canonicalSlots(orgId: $orgId) { key }
    }
  `
  
  const { mutate: triggerReprocessMutate } = useMutation(REPROCESS_MUTATION)
  const { mutate: classifyMutate } = useMutation(CLASSIFY_MUTATION)
  const { mutate: triggerFullSync } = useMutation(TRIGGER_FULL_SYNC)
  
  return {
    triggerReprocessMutate,
    classifyMutate,
    triggerFullSync,
    CANONICAL_SLOTS_QUERY
  }
}
