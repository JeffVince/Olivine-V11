"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StorageProvider_1 = require("../../services/StorageProvider");
const DropboxService_1 = require("../../services/DropboxService");
const GoogleDriveService_1 = require("../../services/GoogleDriveService");
const SupabaseService_1 = require("../../services/SupabaseService");
jest.mock('../../services/DropboxService');
jest.mock('../../services/GoogleDriveService');
jest.mock('../../services/SupabaseService');
describe('StorageProvider', () => {
    describe('StorageProviderFactory', () => {
        it('should create DropboxService instance', () => {
            const provider = StorageProvider_1.StorageProviderFactory.createProvider('dropbox');
            expect(provider).toBeInstanceOf(DropboxService_1.DropboxService);
        });
        it('should create GoogleDriveService instance', () => {
            const provider = StorageProvider_1.StorageProviderFactory.createProvider('gdrive');
            expect(provider).toBeInstanceOf(GoogleDriveService_1.GoogleDriveService);
        });
        it('should create SupabaseService instance', () => {
            const provider = StorageProvider_1.StorageProviderFactory.createProvider('supabase');
            expect(provider).toBeInstanceOf(SupabaseService_1.SupabaseService);
        });
        it('should throw error for unsupported provider type', () => {
            expect(() => {
                StorageProvider_1.StorageProviderFactory.createProvider('unsupported');
            }).toThrow('Unsupported storage provider type: unsupported');
        });
    });
});
//# sourceMappingURL=StorageProvider.test.js.map