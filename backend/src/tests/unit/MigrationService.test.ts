import { MigrationService } from '../../services/MigrationService';
import { Neo4jService } from '../../services/Neo4jService';
import { PostgresService } from '../../services/PostgresService';
import * as fs from 'fs';
import * as path from 'path';

// Mock services
jest.mock('../../services/Neo4jService');
jest.mock('../../services/PostgresService');

// Mock file system operations
jest.mock('fs');

describe('MigrationService', () => {
  let migrationService: MigrationService;
  let mockNeo4jService: jest.Mocked<Neo4jService>;
  let mockPostgresService: jest.Mocked<PostgresService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock services
    mockNeo4jService = new Neo4jService() as jest.Mocked<Neo4jService>;
    mockPostgresService = new PostgresService() as jest.Mocked<PostgresService>;
    
    // Mock service methods
    mockNeo4jService.executeWriteQuery = jest.fn();
    mockNeo4jService.healthCheck = jest.fn().mockResolvedValue(true);
    mockNeo4jService.close = jest.fn().mockResolvedValue(undefined);
    
    mockPostgresService.executeQuery = jest.fn();
    mockPostgresService.healthCheck = jest.fn().mockResolvedValue(true);
    mockPostgresService.close = jest.fn().mockResolvedValue(undefined);
    
    // Mock file system methods
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock)
      .mockReturnValueOnce(['001_test_migration.cypher', '002_test_migration.cypher']) // Neo4j migrations
      .mockReturnValueOnce(['001_test_migration.sql', '002_test_migration.sql']); // PostgreSQL migrations
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.endsWith('.cypher')) {
        return 'MATCH (n) RETURN n; MATCH (m) RETURN m;';
      } else if (filePath.endsWith('.sql')) {
        return 'SELECT * FROM users; CREATE TABLE test (id SERIAL PRIMARY KEY);';
      }
      return '';
    });
    
    migrationService = new MigrationService();
    
    // Replace services with mocks
    (migrationService as any).neo4jService = mockNeo4jService;
    (migrationService as any).postgresService = mockPostgresService;
  });

  describe('applyAllMigrations', () => {
    it('should apply both Neo4j and PostgreSQL migrations', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await migrationService.applyAllMigrations();
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Applying all pending migrations...');
      expect(consoleLogSpy).toHaveBeenCalledWith('All migrations applied successfully!');
      
      consoleLogSpy.mockRestore();
    });
  });

  describe('applyNeo4jMigrations', () => {
    it('should read and execute Neo4j migration files', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await (migrationService as any).applyNeo4jMigrations();
      
      expect(fs.existsSync).toHaveBeenCalledWith(path.join(__dirname, '../../migrations/neo4j'));
      expect(fs.readdirSync).toHaveBeenCalledWith(path.join(__dirname, '../../migrations/neo4j'));
      expect(fs.readFileSync).toHaveBeenCalledWith(
        path.join(__dirname, '../../migrations/neo4j/001_test_migration.cypher'),
        'utf8'
      );
      expect(fs.readFileSync).toHaveBeenCalledWith(
        path.join(__dirname, '../../migrations/neo4j/002_test_migration.cypher'),
        'utf8'
      );
      
      // Check that executeWriteQuery was called for each statement
      expect(mockNeo4jService.executeWriteQuery).toHaveBeenCalledTimes(4);
      
      consoleLogSpy.mockRestore();
    });

    it('should handle case when Neo4j migrations directory does not exist', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((dirPath: string) => {
        return !dirPath.includes('neo4j');
      });
      
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await (migrationService as any).applyNeo4jMigrations();
      
      expect(consoleLogSpy).toHaveBeenCalledWith('No Neo4j migrations directory found');
      
      consoleLogSpy.mockRestore();
    });
  });

  describe('applyPostgresMigrations', () => {
    it('should read and execute PostgreSQL migration files', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await (migrationService as any).applyPostgresMigrations();
      
      expect(fs.existsSync).toHaveBeenCalledWith(path.join(__dirname, '../../migrations/postgres'));
      expect(fs.readdirSync).toHaveBeenCalledWith(path.join(__dirname, '../../migrations/postgres'));
      expect(fs.readFileSync).toHaveBeenCalledWith(
        path.join(__dirname, '../../migrations/postgres/001_test_migration.sql'),
        'utf8'
      );
      expect(fs.readFileSync).toHaveBeenCalledWith(
        path.join(__dirname, '../../migrations/postgres/002_test_migration.sql'),
        'utf8'
      );
      
      // Check that executeQuery was called for each statement
      expect(mockPostgresService.executeQuery).toHaveBeenCalledTimes(4);
      
      consoleLogSpy.mockRestore();
    });

    it('should handle case when PostgreSQL migrations directory does not exist', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((dirPath: string) => {
        return !dirPath.includes('postgres');
      });
      
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await (migrationService as any).applyPostgresMigrations();
      
      expect(consoleLogSpy).toHaveBeenCalledWith('No PostgreSQL migrations directory found');
      
      consoleLogSpy.mockRestore();
    });

    it('should skip duplicate policy errors', async () => {
      // Mock file system to return a policy migration file
      (fs.readdirSync as jest.Mock).mockReturnValue(['001_policy_migration.sql']);
      
      // Mock the file content to contain a CREATE POLICY statement
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.endsWith('001_policy_migration.sql')) {
          return 'CREATE POLICY test_policy ON test_table;\nSELECT * FROM test_table;';
        }
        return '';
      });
      
      // Ensure the first statement is CREATE POLICY so duplicate-policy branch is hit and logged
      mockPostgresService.executeQuery
        .mockRejectedValueOnce(new Error('Policy already exists')) // First statement (CREATE POLICY) fails with duplicate
        .mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] })
        ;
      
      await expect((migrationService as any).applyPostgresMigrations()).resolves.toBeUndefined();
    });
  });

  describe('createMigrationDirectories', () => {
    it('should create migration directories if they do not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.readdirSync as jest.Mock).mockReturnValueOnce([]).mockReturnValueOnce([]);
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await migrationService.createMigrationDirectories();
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        path.join(__dirname, '../../migrations/neo4j'),
        { recursive: true }
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        path.join(__dirname, '../../migrations/postgres'),
        { recursive: true }
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('Created Neo4j migrations directory');
      expect(consoleLogSpy).toHaveBeenCalledWith('Created PostgreSQL migrations directory');
      
      consoleLogSpy.mockRestore();
    });
  });

  describe('healthCheck', () => {
    it('should return true when both services are healthy', async () => {
      mockNeo4jService.healthCheck.mockResolvedValue(true);
      mockPostgresService.healthCheck.mockResolvedValue(true);
      
      const isHealthy = await migrationService.healthCheck();
      
      expect(isHealthy).toBe(true);
      expect(mockNeo4jService.healthCheck).toHaveBeenCalled();
      expect(mockPostgresService.healthCheck).toHaveBeenCalled();
    });

    it('should return false when Neo4j service is not healthy', async () => {
      mockNeo4jService.healthCheck.mockResolvedValue(false);
      mockPostgresService.healthCheck.mockResolvedValue(true);
      
      const isHealthy = await migrationService.healthCheck();
      
      expect(isHealthy).toBe(false);
    });

    it('should return false when PostgreSQL service is not healthy', async () => {
      mockNeo4jService.healthCheck.mockResolvedValue(true);
      mockPostgresService.healthCheck.mockResolvedValue(false);
      
      const isHealthy = await migrationService.healthCheck();
      
      expect(isHealthy).toBe(false);
    });

    it('should handle errors during health check', async () => {
      mockNeo4jService.healthCheck.mockRejectedValue(new Error('Health check failed'));
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const isHealthy = await migrationService.healthCheck();
      
      expect(isHealthy).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Migration service health check failed:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('close', () => {
    it('should close both Neo4j and PostgreSQL connections', async () => {
      await migrationService.close();
      
      expect(mockNeo4jService.close).toHaveBeenCalled();
      expect(mockPostgresService.close).toHaveBeenCalled();
    });
  });
});
