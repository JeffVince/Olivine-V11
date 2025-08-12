import { PostgresService } from '../../services/PostgresService';
import { Pool, QueryResult } from 'pg';
import { ConfigService } from '../../services/ConfigService';

// Mock services
jest.mock('../../services/ConfigService');
jest.mock('pg');

// Mock Postgres pool and client
const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
  query: jest.fn(),
  end: jest.fn(),
  on: jest.fn()
};

describe('PostgresService', () => {
  let postgresService: PostgresService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock config service
    mockConfigService = new ConfigService() as jest.Mocked<ConfigService>;
    mockConfigService.getPostgresConfig = jest.fn().mockReturnValue({
      host: 'localhost',
      port: 5432,
      database: 'olivine_test',
      user: 'test_user',
      password: 'test_password',
      maxConnections: 20,
      idleTimeout: 30000,
      connectionTimeout: 2000
    });
    
    // Mock pg Pool
    jest.mock('pg', () => ({
      Pool: jest.fn().mockImplementation(() => mockPool)
    }));
    
    postgresService = new PostgresService();
    (postgresService as any).configService = mockConfigService;
    (postgresService as any).pool = mockPool;
  });

  describe('executeQuery', () => {
    it('should execute query with parameters and return results', async () => {
      const query = 'SELECT * FROM users WHERE id = $1';
      const params = ['user_id'];
      const result: QueryResult = {
        rows: [{ id: 'user_id', name: 'test_user' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      };
      
      mockPool.query.mockResolvedValue(result);
      
      const response = await postgresService.executeQuery(query, params);
      
      expect(mockPool.query).toHaveBeenCalledWith(query, params);
      expect(response).toBe(result);
    });

    it('should execute query without parameters when not provided', async () => {
      const query = 'SELECT * FROM users';
      const result: QueryResult = {
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      };
      
      mockPool.query.mockResolvedValue(result);
      
      const response = await postgresService.executeQuery(query);
      
      expect(mockPool.query).toHaveBeenCalledWith(query, []);
      expect(response).toBe(result);
    });
  });

  describe('executeTransaction', () => {
    it('should execute multiple queries in a transaction', async () => {
      const queries = [
        { query: 'INSERT INTO users (name) VALUES ($1)', params: ['user1'] },
        { query: 'INSERT INTO users (name) VALUES ($1)', params: ['user2'] }
      ];
      
      const result1: QueryResult = {
        rows: [{ id: 1 }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      };
      
      const result2: QueryResult = {
        rows: [{ id: 2 }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      };
      
      mockClient.query
        .mockResolvedValueOnce(result1)
        .mockResolvedValueOnce(result2);
      
      const response = await postgresService.executeTransaction(queries);
      
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(mockClient.release).toHaveBeenCalled();
      expect(response).toEqual([result1, result2]);
    });

    it('should rollback transaction on error', async () => {
      const queries = [
        { query: 'INSERT INTO users (name) VALUES ($1)', params: ['user1'] }
      ];
      
      mockClient.query.mockRejectedValue(new Error('Query failed'));
      
      await expect(postgresService.executeTransaction(queries)).rejects.toThrow('Query failed');
      
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return true when connection test succeeds', async () => {
      const result: QueryResult = {
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      };
      
      mockPool.query.mockResolvedValue(result);
      
      const isHealthy = await postgresService.healthCheck();
      
      expect(isHealthy).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return false when connection test fails', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection failed'));
      
      const isHealthy = await postgresService.healthCheck();
      
      expect(isHealthy).toBe(false);
    });
  });

  describe('close', () => {
    it('should close the pool connection', async () => {
      await postgresService.close();
      
      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});
