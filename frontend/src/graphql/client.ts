import { ApolloClient, InMemoryCache, from, split, HttpLink } from '@apollo/client/core'
import { getMainDefinition } from '@apollo/client/utilities'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { createUploadLink } from 'apollo-upload-client'
import { createClient as createWsClient } from 'graphql-ws'
import { useAuthStore } from '@/stores/authStore'


const GRAPHQL_HTTP = `${import.meta.env.VITE_GRAPHQL_URL || ''}`
const GRAPHQL_WS = `${import.meta.env.VITE_GRAPHQL_WS_URL || ''}`

if (!GRAPHQL_HTTP || !GRAPHQL_WS) {
  // Do not throw; but enforce that envs are provided in deployment. No fallbacks.
  // eslint-disable-next-line no-console
  console.warn('GraphQL endpoints are not configured. Set VITE_GRAPHQL_URL and VITE_GRAPHQL_WS_URL')
}

// Create an HTTP link for regular queries and mutations
const httpLink = new HttpLink({
  uri: GRAPHQL_HTTP,
  credentials: 'include',
  headers: {
    'Apollo-Require-Preflight': 'true',
  },
})

// Create an upload link for file uploads
const uploadLink = createUploadLink({
  uri: GRAPHQL_HTTP,
  credentials: 'include',
  headers: {
    'Apollo-Require-Preflight': 'true',
  },
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

// Split between WebSocket, upload, and HTTP links
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query)
    return definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
  },
  wsLink,
  // Use upload link for mutations containing files, otherwise use regular HTTP link
  split(
    ({ variables }) => {
      // Check if any variable is a File or FileList
      return variables && Object.values(variables).some(
        (value) => value instanceof File || value instanceof FileList
      )
    },
    uploadLink,
    authLink.concat(httpLink)
  )
)

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, ` +
        `Location: ${JSON.stringify(locations)}, ` +
        `Path: ${path}`
      )
    })
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError.message}`, {
      operationName: operation?.operationName,
      variables: operation?.variables,
    })
  }
})

// Create the Apollo Client with all links
const link = from([errorLink, splitLink])

export const apolloClient = new ApolloClient({
  link,
  cache: new InMemoryCache({
    typePolicies: {
      // Add any custom type policies here
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
})

export default apolloClient;


