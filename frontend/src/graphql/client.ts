import { ApolloClient, InMemoryCache, from, split, HttpLink } from '@apollo/client/core'
import { getMainDefinition } from '@apollo/client/utilities'
import { setContext } from '@apollo/client/link/context'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { createClient as createWsClient } from 'graphql-ws'
import { useAuthStore } from '@/stores/authStore'

const GRAPHQL_HTTP = `${import.meta.env.VITE_GRAPHQL_URL || ''}`
const GRAPHQL_WS = `${import.meta.env.VITE_GRAPHQL_WS_URL || ''}`

if (!GRAPHQL_HTTP || !GRAPHQL_WS) {
  // Do not throw; but enforce that envs are provided in deployment. No fallbacks.
  // eslint-disable-next-line no-console
  console.warn('GraphQL endpoints are not configured. Set VITE_GRAPHQL_URL and VITE_GRAPHQL_WS_URL')
}

const httpLink = new HttpLink({
  uri: GRAPHQL_HTTP,
  credentials: 'include',
})

const authLink = setContext((_, { headers }) => {
  const auth = useAuthStore()
  const token = auth.accessToken
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }
})

const wsLink = new GraphQLWsLink(createWsClient({
  url: GRAPHQL_WS,
  connectionParams: () => {
    const auth = useAuthStore()
    const token = auth.accessToken
    return token ? { Authorization: `Bearer ${token}` } : {}
  },
}))

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query)
    return definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
  },
  wsLink,
  authLink.concat(httpLink)
)

export const apolloClient = new ApolloClient({
  link: from([splitLink]),
  cache: new InMemoryCache(),
})


