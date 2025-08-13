import { StorageProviderFactory, StorageProviderType } from '../../services/StorageProvider';
import { DropboxService } from '../../services/DropboxService';
import { GoogleDriveService } from '../../services/GoogleDriveService';
import { SupabaseService } from '../../services/SupabaseService';

// Mock the services to avoid actual API calls
jest.mock('../../services/DropboxService');
jest.mock('../../services/GoogleDriveService');
jest.mock('../../services/SupabaseService');

describe('StorageProvider', () => {
  describe('StorageProviderFactory', () => {
    it('should create DropboxService instance', async () => {
      const provider = await StorageProviderFactory.createProvider('dropbox');
      expect(provider).toBeInstanceOf(DropboxService);
    });

    it('should create GoogleDriveService instance', async () => {
      const provider = await StorageProviderFactory.createProvider('gdrive');
      expect(provider).toBeInstanceOf(GoogleDriveService);
    });

    it('should create SupabaseService instance', async () => {
      const provider = await StorageProviderFactory.createProvider('supabase');
      expect(provider).toBeInstanceOf(SupabaseService);
    });

    it('should throw error for unsupported provider type', async () => {
      // @ts-ignore - Testing invalid type
      await expect(StorageProviderFactory.createProvider('unsupported')).rejects.toThrow(
        'Unsupported storage provider type: unsupported'
      );
    });
  });
});
