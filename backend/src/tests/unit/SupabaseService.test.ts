import { SupabaseService, SupabaseTokenData } from '../../services/SupabaseService';
import { createClient } from '@supabase/supabase-js';

// Mock the dependencies
jest.mock('../../services/PostgresService');
jest.mock('../../services/ConfigService');

// Mock Supabase client
// Mock createClient function
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
  SupabaseClient: jest.fn()
}));

const mockStorageFrom = {
  upload: jest.fn(),
  download: jest.fn(),
  list: jest.fn(),
  remove: jest.fn()
};

const mockStorage = {
  from: jest.fn().mockReturnValue(mockStorageFrom)
};

const mockChannel = {
  subscribe: jest.fn()
};

let mockClient: any;

beforeEach(() => {
  mockClient = {
    storage: mockStorage,
    channel: jest.fn().mockReturnValue(mockChannel),
    supabaseUrl: 'test-url',
    supabaseKey: 'test-key',
    auth: {},
    realtime: {},
    from: jest.fn(),
    rpc: jest.fn(),
    schema: 'public',
    rest: {},
    storageKey: 'test-storage-key',
    fetch: undefined,
    headers: {},
    realtimeUrl: new URL('http://test-realtime-url.com'),
    authUrl: new URL('http://test-auth-url.com'),
    storageUrl: new URL('http://test-storage-url.com'),
    functionsUrl: new URL('http://test-functions-url.com')
  };
  
  (jest.mocked(createClient) as jest.Mock).mockReturnValue(mockClient);
});

describe('SupabaseService', () => {
  let supabaseService: SupabaseService;
  
  beforeEach(() => {
    supabaseService = new SupabaseService();
    jest.clearAllMocks();
  });

  describe('getClient', () => {
    it('should return null when no tokens are found', async () => {
      // Mock getStoredTokens to return null
      jest.spyOn(supabaseService, 'getStoredTokens').mockResolvedValue(null);
      
      const client = await supabaseService.getClient('org1', 'source1');
      expect(client).toBeNull();
    });

    it('should create and return a Supabase client when tokens are available', async () => {
      const tokenData: SupabaseTokenData = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: Date.now() + 3600000,
        token_type: 'bearer'
      };
      
      // Mock getStoredTokens to return token data
      jest.spyOn(supabaseService, 'getStoredTokens').mockResolvedValue(tokenData);
      
      const client = await supabaseService.getClient('org1', 'source1');
      expect(client).not.toBeNull();
    });
  });

  describe('uploadFile', () => {
    it('should upload a file successfully', async () => {
      const mockData = { path: 'test/file.txt' };
      mockStorageFrom.upload.mockResolvedValue({ data: mockData, error: null });
      
      // Mock getClient to return our mock client
      jest.spyOn(supabaseService, 'getClient').mockResolvedValue(mockClient);
      
      const result = await supabaseService.uploadFile(
        'org1', 
        'source1', 
        'test/file.txt', 
        Buffer.from('test content'), 
        'text/plain'
      );
      
      expect(result).toEqual(mockData);
      expect(mockStorage.from).toHaveBeenCalledWith('files');
      expect(mockStorageFrom.upload).toHaveBeenCalledWith(
        'test/file.txt', 
        Buffer.from('test content'), 
        { contentType: 'text/plain', upsert: true }
      );
    });

    it('should throw an error when upload fails', async () => {
      const mockError = { message: 'Upload failed' };
      mockStorageFrom.upload.mockResolvedValue({ data: null, error: mockError });
      
      // Mock getClient to return our mock client
      jest.spyOn(supabaseService, 'getClient').mockResolvedValue(mockClient);
      
      await expect(
        supabaseService.uploadFile(
          'org1', 
          'source1', 
          'test/file.txt', 
          Buffer.from('test content'), 
          'text/plain'
        )
      ).rejects.toThrow('Error uploading file to Supabase: Upload failed');
    });
  });

  describe('downloadFile', () => {
    it('should download a file successfully', async () => {
      const mockData = Buffer.from('test content');
      mockStorageFrom.download.mockResolvedValue({ data: mockData, error: null });
      
      // Mock getClient to return our mock client
      jest.spyOn(supabaseService, 'getClient').mockResolvedValue(mockClient);
      
      const result = await supabaseService.downloadFile('org1', 'source1', 'test/file.txt');
      
      expect(result).toEqual(mockData);
      expect(mockStorage.from).toHaveBeenCalledWith('files');
      expect(mockStorageFrom.download).toHaveBeenCalledWith('test/file.txt');
    });
  });

  describe('listFiles', () => {
    it('should list files successfully', async () => {
      const mockData = [{ name: 'file1.txt' }, { name: 'file2.txt' }];
      mockStorageFrom.list.mockResolvedValue({ data: mockData, error: null });
      
      // Mock getClient to return our mock client
      jest.spyOn(supabaseService, 'getClient').mockResolvedValue(mockClient);
      
      const result = await supabaseService.listFiles('org1', 'source1');
      
      expect(result).toEqual(mockData);
      expect(mockStorage.from).toHaveBeenCalledWith('files');
      expect(mockStorageFrom.list).toHaveBeenCalledWith(undefined);
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      const mockData = { name: 'file.txt' };
      mockStorageFrom.remove.mockResolvedValue({ data: mockData, error: null });
      
      // Mock getClient to return our mock client
      jest.spyOn(supabaseService, 'getClient').mockResolvedValue(mockClient);
      
      const result = await supabaseService.deleteFile('org1', 'source1', 'test/file.txt');
      
      expect(result).toEqual(mockData);
      expect(mockStorage.from).toHaveBeenCalledWith('files');
      expect(mockStorageFrom.remove).toHaveBeenCalledWith(['test/file.txt']);
    });
  });
});
