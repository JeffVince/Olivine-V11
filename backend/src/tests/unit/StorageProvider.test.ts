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
    it('should create DropboxService instance', () => {
      const provider = StorageProviderFactory.createProvider('dropbox');
      expect(provider).toBeInstanceOf(DropboxService);
    });

    it('should create GoogleDriveService instance', () => {
      const provider = StorageProviderFactory.createProvider('gdrive');
      expect(provider).toBeInstanceOf(GoogleDriveService);
    });

    it('should create SupabaseService instance', () => {
      const provider = StorageProviderFactory.createProvider('supabase');
      expect(provider).toBeInstanceOf(SupabaseService);
    });

    it('should throw error for unsupported provider type', () => {
      expect(() => {
        // @ts-ignore - Testing invalid type
        StorageProviderFactory.createProvider('unsupported');
      }).toThrow('Unsupported storage provider type: unsupported');
    });
  });
});
