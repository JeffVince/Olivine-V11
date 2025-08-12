# Storage Providers API Documentation

## Overview

The storage providers module provides a unified interface for interacting with multiple cloud storage services including Dropbox, Google Drive, and Supabase. This abstraction allows the application to work with different storage providers through a consistent API.

## Architecture

The storage providers module follows a factory pattern architecture:

1. **StorageProvider Interface**: Defines the common methods that all storage providers must implement
2. **Concrete Providers**: Implementation classes for each storage service (DropboxService, GoogleDriveService, SupabaseService)
3. **StorageProviderFactory**: Factory class responsible for creating instances of storage providers
4. **MultiProviderSyncOrchestrator**: Coordinates synchronization across multiple providers

## StorageProvider Interface

All storage providers implement the following interface:

```typescript
interface StorageProvider {
  // OAuth flow methods
  generateAuthUrl(): Promise<string>;
  exchangeCodeForTokens(code: string): Promise<any>;
  refreshAccessToken(refreshToken: string): Promise<any>;
  
  // File operations
  listFiles(path: string): Promise<any[]>;
  downloadFile(path: string): Promise<Buffer>;
  uploadFile(path: string, content: Buffer, mimeType: string): Promise<any>;
  deleteFile(path: string): Promise<any>;
  getFileMetadata(path: string): Promise<any>;
  
  // Real-time subscriptions (where supported)
  subscribeToChanges(callback: (change: any) => void): Promise<any>;
}
```

## Provider-Specific Documentation

### DropboxService

The DropboxService provides integration with Dropbox API v2.

#### Key Features
- OAuth 2.0 with offline access and refresh tokens
- Team account support with namespace handling
- Webhook integration for real-time change notifications
- Delta sync for efficient change detection
- Path root handling for team vs personal accounts

#### Environment Variables
- `DROPBOX_APP_KEY`: Dropbox app key
- `DROPBOX_APP_SECRET`: Dropbox app secret
- `DROPBOX_WEBHOOK_SECRET`: Webhook validation secret
- `DROPBOX_REDIRECT_URI`: OAuth redirect URI

### GoogleDriveService

The GoogleDriveService provides integration with Google Drive API v3.

#### Key Features
- OAuth 2.0 with offline access and refresh tokens
- Change detection using Google Drive changes API
- Push notifications via webhook handlers
- Page token management for incremental sync

#### Environment Variables
- `GOOGLE_CLIENT_ID`: Google client ID
- `GOOGLE_CLIENT_SECRET`: Google client secret
- `GOOGLE_REDIRECT_URI`: OAuth redirect URI
- `GOOGLE_DRIVE_SCOPES`: Comma-separated list of Google Drive scopes

### SupabaseService

The SupabaseService provides integration with Supabase Storage.

#### Key Features
- JWT-based authentication
- Real-time subscriptions using Supabase Realtime
- Row Level Security (RLS) support
- Bucket management

#### Environment Variables
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_KEY`: Supabase API key
- `SUPABASE_JWT_SECRET`: JWT secret for webhook validation
- `SUPABASE_STORAGE_BUCKET`: Default storage bucket name

## Usage Examples

### Creating a Storage Provider

```typescript
import { StorageProviderFactory } from './services/StorageProvider';

// Create a Dropbox provider
const dropboxProvider = StorageProviderFactory.createProvider('dropbox');

// Create a Google Drive provider
const gdriveProvider = StorageProviderFactory.createProvider('gdrive');

// Create a Supabase provider
const supabaseProvider = StorageProviderFactory.createProvider('supabase');
```

### Using a Storage Provider

```typescript
// Generate authorization URL
const authUrl = await provider.generateAuthUrl();

// Exchange code for tokens
const tokens = await provider.exchangeCodeForTokens(code);

// List files
const files = await provider.listFiles('/');

// Download a file
const fileContent = await provider.downloadFile('path/to/file.txt');

// Upload a file
const result = await provider.uploadFile('path/to/file.txt', content, 'text/plain');

// Delete a file
await provider.deleteFile('path/to/file.txt');
```

### Multi-Provider Orchestration

```typescript
import { StorageProviderFactory } from './services/StorageProvider';

const orchestrator = StorageProviderFactory.createOrchestrator();

// Sync multiple providers
await orchestrator.syncProviders('org123', ['source1', 'source2', 'source3']);

// Resolve conflicts
await orchestrator.resolveConflicts('org123', conflicts);

// Optimize operations
await orchestrator.optimizeOperations('org123', operations);
```

## Error Handling

All storage providers implement consistent error handling patterns:

- Network errors are automatically retried with exponential backoff
- Authentication errors trigger token refresh flows
- Rate limiting is handled with appropriate delays
- Service-specific errors are normalized to common error types

## Security

- All tokens are securely stored in encrypted database fields
- OAuth flows use PKCE where supported
- Webhook payloads are validated with signatures
- Access tokens are automatically refreshed before expiration
- Row Level Security is enforced for Supabase operations

## Monitoring

- All operations are logged with timing information
- Error rates and success metrics are tracked
- Webhook delivery and processing is monitored
- Sync operations report progress and completion status
