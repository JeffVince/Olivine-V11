import { ref, watchEffect } from 'vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { useOrganizationStore } from '@/stores/organizationStore'

interface TaxonomyRule {
  id: string
  slotKey: string
  matchPattern: string
  priority: number
  enabled: boolean
}

interface TaxonomySuggestion {
  id: string
  slotKey: string
  proposedPattern: string
  confidence: number
}

// Based on Implementation Plan, wire to taxonomy profiles/rules endpoints when available
const LIST_RULES = gql`
  query ListRules($orgId: ID!, $limit: Int, $offset: Int) {
    taxonomyRules(orgId: $orgId, limit: $limit, offset: $offset) {
      id
      slotKey
      matchPattern
      priority
      enabled
    }
  }
`

const LIST_SUGGESTIONS = gql`
  query TaxonomySuggestions($orgId: ID!) {
    taxonomySuggestions(orgId: $orgId) {
      id
      slotKey
      proposedPattern
      confidence
    }
  }
`

const PROMOTE_SUGGESTION = gql`
  mutation PromoteSuggestion($orgId: ID!, $suggestionId: ID!) {
    promoteTaxonomySuggestion(orgId: $orgId, suggestionId: $suggestionId) {
      id
    }
  }
`

export function useMapping() {
  const org = useOrganizationStore()
  const variables = ref({ orgId: org.currentOrg?.id || '', limit: 100, offset: 0 })
  const { result, loading, refetch } = useQuery(LIST_RULES, variables)
  const rules = ref<TaxonomyRule[]>([])
  const { result: sugResult, refetch: refetchSug } = useQuery(LIST_SUGGESTIONS, () => ({ orgId: org.currentOrg?.id || '' }))
  const suggestions = ref<TaxonomySuggestion[]>([])

  watchEffect(() => {
    variables.value.orgId = org.currentOrg?.id || ''
  })
  watchEffect(() => {
    if (result.value?.taxonomyRules) rules.value = result.value.taxonomyRules
  })
  watchEffect(() => {
    if (sugResult.value?.taxonomySuggestions) suggestions.value = sugResult.value.taxonomySuggestions
  })

  const { mutate: promote } = useMutation(PROMOTE_SUGGESTION)

  return { rules, suggestions, loading, refetch, refetchSug, promote }
}


