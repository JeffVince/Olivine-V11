declare module 'graphql-ws' {
  export function createClient(options: any): any
}

declare module '@apollo/client/link/subscriptions' {
  import { ApolloLink } from '@apollo/client/core'
  export class GraphQLWsLink extends ApolloLink {
    constructor(client: any)
  }
}


