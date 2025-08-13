declare module 'graphql-ws' {
  export function createClient(options: Record<string, unknown>): unknown
}

declare module '@apollo/client/link/subscriptions' {
  import { ApolloLink } from '@apollo/client/core'
  export class GraphQLWsLink extends ApolloLink {
    constructor(client: unknown)
  }
}


