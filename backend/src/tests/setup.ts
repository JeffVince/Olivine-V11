// Simplified test setup - load environment variables if available
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, continue without it
}

// Set test environment
process.env.NODE_ENV = 'test';

// Configure test timeouts
jest.setTimeout(30000);

// Global test utilities
(global as any).testUtils = {
  generateTestId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  
  waitForCondition: async (condition: () => Promise<boolean>, timeout: number = 5000, interval: number = 100) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  cleanupDatabase: async (services: { neo4j?: any; postgres?: any }, orgId: string) => {
    if (services.neo4j) {
      await services.neo4j.run('MATCH (n {org_id: $orgId}) DETACH DELETE n', { orgId });
    }
    if (services.postgres) {
      const tables = [
        'taxonomy_rules', 'taxonomy_profiles', 'files', 'sources', 
        'organizations', 'projects', 'users'
      ];
      for (const table of tables) {
        await services.postgres.executeQuery(`DELETE FROM ${table} WHERE org_id = $1`, [orgId]);
      }
    }
  }
};

// Mock external services for testing
jest.mock('../services/DropboxService', () => {
  return {
    DropboxService: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(true),
      listFiles: jest.fn().mockResolvedValue([]),
      getFileMetadata: jest.fn().mockResolvedValue({}),
      downloadFile: jest.fn().mockResolvedValue(Buffer.from('test'))
    }))
  };
});

jest.mock('../services/GoogleDriveService', () => {
  return {
    GoogleDriveService: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(true),
      listFiles: jest.fn().mockResolvedValue([]),
      getFileMetadata: jest.fn().mockResolvedValue({}),
      downloadFile: jest.fn().mockResolvedValue(Buffer.from('test'))
    }))
  };
});

// Suppress console logs in tests unless explicitly enabled
if (!process.env.ENABLE_TEST_LOGS) {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// TypeScript global declaration
declare global {
  namespace NodeJS {
    interface Global {
      testUtils: {
        generateTestId: () => string;
        waitForCondition: (condition: () => Promise<boolean>, timeout?: number, interval?: number) => Promise<boolean>;
        cleanupDatabase: (services: { neo4j?: any; postgres?: any }, orgId: string) => Promise<void>;
      };
    }
  }
}

// This export makes the file an external module, which is required for global declarations
export {};
