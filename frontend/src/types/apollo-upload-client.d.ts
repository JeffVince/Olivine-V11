declare module 'apollo-upload-client' {
  import { ApolloLink } from '@apollo/client/core';

  export interface CreateUploadLinkOptions {
    uri?: string | ((operation: any) => string);
    credentials?: string;
    headers?: any;
    fetch?: typeof fetch;
    includeExtensions?: boolean;
    fetchOptions?: any;
  }

  export function createUploadLink(
    options?: CreateUploadLinkOptions
  ): ApolloLink;
}
