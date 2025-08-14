declare module 'apollo-upload-client' {
  import { ApolloLink } from '@apollo/client/core';

  export interface CreateUploadLinkOptions {
    uri?: unknown;
    credentials?: unknown;
    headers?: unknown;
    fetch?: unknown;
    includeExtensions?: unknown;
    fetchOptions?: unknown;
  }

  export function createUploadLink(
    options?: CreateUploadLinkOptions
  ): ApolloLink;
}
