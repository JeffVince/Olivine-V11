"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DropboxService_1 = require("../../services/DropboxService");
const GoogleDriveService_1 = require("../../services/GoogleDriveService");
const SupabaseService_1 = require("../../services/SupabaseService");
describe('StorageProvider Integration', () => {
    describe('DropboxService Integration', () => {
        let dropboxService;
        beforeAll(() => {
            dropboxService = new DropboxService_1.DropboxService();
        });
        it('should generate authorization URL', async () => {
            const authUrl = await dropboxService.generateAuthUrl();
            expect(authUrl).toContain('https://dropbox.com/oauth2/authorize');
        });
    });
    describe('GoogleDriveService Integration', () => {
        let googleDriveService;
        beforeAll(() => {
            googleDriveService = new GoogleDriveService_1.GoogleDriveService();
        });
        it('should generate authorization URL', () => {
            const authUrl = googleDriveService.generateAuthUrl();
            expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
        });
    });
    describe('SupabaseService Integration', () => {
        let supabaseService;
        beforeAll(() => {
            supabaseService = new SupabaseService_1.SupabaseService();
        });
        it('should initialize SupabaseService', () => {
            expect(supabaseService).toBeDefined();
        });
    });
});
//# sourceMappingURL=StorageProvider.integration.test.js.map