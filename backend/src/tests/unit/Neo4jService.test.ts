import { Neo4jService } from '../../services/Neo4jService';
import { Driver, Session, QueryResult } from 'neo4j-driver';
import { ConfigService } from '../../services/ConfigService';

// Mock services
jest.mock('../../services/ConfigService');
jest.mock('neo4j-driver');

// Mock Neo4j driver and session
const mockSession = {
  run: jest.fn(),
  close: jest.fn()
};

const mockDriver = {
  session: jest.fn().mockReturnValue(mockSession),
  verifyConnectivity: jest.fn(),
  close: jest.fn()
};

describe('Neo4jService', () => {
  let neo4jService: Neo4jService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock config service
    mockConfigService = new ConfigService() as jest.Mocked<ConfigService>;
    mockConfigService.getNeo4jConfig = jest.fn().mockReturnValue({
      uri: 'bolt://localhost:7687',
      user: 'neo4j',
      password: 'password',
      encrypted: false,
      maxConnectionPoolSize: 10,
      connectionTimeout: 30000
    });
    
    // Mock neo4j driver
    const neo4j = require('neo4j-driver');
    neo4j.driver.mockReturnValue(mockDriver);
    neo4j.auth.basic.mockReturnValue({ scheme: 'basic', principal: 'neo4j', credentials: 'password' });
    
    neo4jService = new Neo4jService();
    (neo4jService as any).configService = mockConfigService;
    (neo4jService as any).driver = mockDriver;
  });

  describe('executeQuery', () => {
    it('should execute query with parameters and return results', async () => {
      const query = 'MATCH (n:Test) RETURN n';
      const params = { test: 'value' };
      const orgId = 'test_org_id';
      const result: QueryResult = {
        records: [],
        summary: {} as any
      };
      
      mockSession.run.mockResolvedValue(result);
      
      const response = await neo4jService.executeQuery(query, params, orgId);
      
      expect(mockDriver.session).toHaveBeenCalledWith({
        database: 'neo4j',
        defaultAccessMode: 'READ'
      });
      expect(mockSession.run).toHaveBeenCalledWith(query, { ...params, orgId });
      expect(mockSession.close).toHaveBeenCalled();
      expect(response).toBe(result);
    });

    it('should execute query without orgId when not provided', async () => {
      const query = 'MATCH (n:Test) RETURN n';
      const params = { test: 'value' };
      const result: QueryResult = {
        records: [],
        summary: {} as any
      };
      
      mockSession.run.mockResolvedValue(result);
      
      const response = await neo4jService.executeQuery(query, params);
      
      expect(mockSession.run).toHaveBeenCalledWith(query, params);
      expect(response).toBe(result);
    });

    it('should add orgId to parameters when provided', async () => {
      const query = 'MATCH (n:Test {id: $id}) RETURN n';
      const params = { id: 'test_id' };
      const orgId = 'org_123';
      const result: QueryResult = {
        records: [],
        summary: {} as any
      };
      
      mockSession.run.mockResolvedValue(result);
      
      await neo4jService.executeQuery(query, params, orgId);
      
      expect(mockSession.run).toHaveBeenCalledWith(query, { id: 'test_id', orgId: 'org_123' });
    });
  });

  describe('executeWriteQuery', () => {
    it('should execute write query and return results', async () => {
      const query = 'CREATE (n:Test {name: $name}) RETURN n';
      const params = { name: 'test_name' };
      const orgId = 'test_org_id';
      const result: QueryResult = {
        records: [],
        summary: {} as any
      };
      
      mockSession.run.mockResolvedValue(result);
      
      const response = await neo4jService.executeWriteQuery(query, params, orgId);
      
      expect(mockDriver.session).toHaveBeenCalledWith({
        database: 'neo4j',
        defaultAccessMode: 'WRITE'
      });
      expect(mockSession.run).toHaveBeenCalledWith(query, { ...params, orgId });
      expect(mockSession.close).toHaveBeenCalled();
      expect(response).toBe(result);
    });
  });

  describe('executeTransaction', () => {
    it('should execute multiple queries in a transaction', async () => {
      const queries = [
        { query: 'CREATE (n:Test {name: $name})', params: { name: 'test1' } },
        { query: 'CREATE (m:Test {name: $name})', params: { name: 'test2' } }
      ];
      const orgId = 'test_org_id';
      
      const mockTx = {
        run: jest.fn().mockResolvedValue({ records: [] }),
        commit: jest.fn(),
        rollback: jest.fn()
      };
      
      const mockTxSession = {
        ...mockSession,
        beginTransaction: jest.fn().mockResolvedValue(mockTx)
      };
      
      (mockDriver.session as jest.Mock).mockReturnValue(mockTxSession);
      
      await neo4jService.executeTransaction(queries, orgId);
      
      expect(mockTx.run).toHaveBeenCalledTimes(2);
      expect(mockTx.commit).toHaveBeenCalled();
      expect(mockTxSession.close).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const queries = [
        { query: 'CREATE (n:Test {name: $name})', params: { name: 'test1' } }
      ];
      const orgId = 'test_org_id';
      
      const mockTx = {
        run: jest.fn().mockRejectedValue(new Error('Query failed')),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined)
      };
      
      const mockTxSession = {
        ...mockSession,
        beginTransaction: jest.fn().mockResolvedValue(mockTx)
      };
      
      (mockDriver.session as jest.Mock).mockReturnValue(mockTxSession);
      
      await expect(neo4jService.executeTransaction(queries, orgId)).rejects.toThrow('Query failed');
      
      expect(mockTx.rollback).toHaveBeenCalled();
    });
  });

  describe('executeBatch', () => {
    it('should execute batch queries with parameters', async () => {
      const queries = [
        'CREATE (n:Test {id: $id})',
        'MATCH (n:Test {id: $id}) SET n.processed = true'
      ];
      const paramsList = [
        { id: '1' },
        { id: '2' }
      ];
      const orgId = 'test_org_id';
      
      const mockTx = {
        run: jest.fn().mockResolvedValue({ records: [] }),
        commit: jest.fn(),
        rollback: jest.fn()
      };
      
      const mockTxSession = {
        ...mockSession,
        beginTransaction: jest.fn().mockResolvedValue(mockTx)
      };
      
      (mockDriver.session as jest.Mock).mockReturnValue(mockTxSession);
      
      await neo4jService.executeBatch(queries, paramsList, orgId);
      
      expect(mockTx.run).toHaveBeenCalledTimes(2);
      expect(mockTx.commit).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return true when connectivity verification succeeds', async () => {
      mockDriver.verifyConnectivity.mockResolvedValue(undefined);
      
      const isHealthy = await neo4jService.healthCheck();
      
      expect(isHealthy).toBe(true);
      expect(mockDriver.verifyConnectivity).toHaveBeenCalled();
    });

    it('should return false when connectivity verification fails', async () => {
      mockDriver.verifyConnectivity.mockRejectedValue(new Error('Connection failed'));
      
      const isHealthy = await neo4jService.healthCheck();
      
      expect(isHealthy).toBe(false);
    });
  });

  describe('close', () => {
    it('should close the driver connection', async () => {
      await neo4jService.close();
      
      expect(mockDriver.close).toHaveBeenCalled();
    });
  });
});
