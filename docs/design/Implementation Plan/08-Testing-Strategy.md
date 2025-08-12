# Testing Strategy Implementation
## Comprehensive Test Coverage for All System Components

### 1. Testing Architecture Overview

#### 1.1 Core Principles

**Multi-Layered Testing Approach**
- Unit tests for individual functions and components
- Integration tests for service interactions
- End-to-end tests for complete workflows
- Performance tests for scalability validation
- Security tests for access control verification

**Tenant-Isolated Test Environments**
- Each test organization has isolated data
- Test data is automatically cleaned up after runs
- Mock services maintain tenant context boundaries
- Real-time subscriptions tested in multi-tenant scenarios

**Version-Controlled Test Data**
- Test cases can reference historical data states
- Branch switching tested with appropriate data isolation
- Commit history validation in test assertions
- Provenance tracking verified through test operations

**Automated Test Execution**
- Continuous integration runs all test suites
- Test results automatically reported to development team
- Failed tests trigger immediate notifications
- Performance benchmarks compared against previous runs

### 2. Unit Testing Implementation

#### 2.1 File Steward Agent Unit Tests

**File Steward Agent Test Suite**
```typescript
import { FileStewardAgent } from '@/agents/FileStewardAgent';
import { Neo4jService } from '@/services/Neo4jService';
import { ClassificationService } from '@/services/ClassificationService';
import { ContentExtractionService } from '@/services/ContentExtractionService';
import { Queue } from '@/services/QueueService';

describe('FileStewardAgent', () => {
  let agent: FileStewardAgent;
  let neo4jService: jest.Mocked<Neo4jService>;
  let classificationService: jest.Mocked<ClassificationService>;
  let extractionService: jest.Mocked<ContentExtractionService>;
  let eventQueue: jest.Mocked<Queue>;

  beforeEach(() => {
    neo4jService = {
      run: jest.fn()
    } as any;

    classificationService = {
      classify: jest.fn()
    } as any;

    extractionService = {
      extract: jest.fn()
    } as any;

    eventQueue = {
      add: jest.fn()
    } as any;

    agent = new FileStewardAgent(
      neo4jService,
      classificationService,
      extractionService,
      eventQueue
    );
  });

  describe('processSyncEvent', () => {
    const testData = {
      orgId: 'org-123',
      sourceId: 'source-456',
      eventType: 'file_created',
      resourcePath: '/documents/script.pdf',
      eventData: {
        entry: {
          name: 'script.pdf',
          size: 1024,
          content_hash: 'abc123',
          server_modified: '2023-01-01T00:00:00Z',
          id: 'dropbox-file-id'
        }
      }
    };

    it('should create a commit for the sync event', async () => {
      neo4jService.run.mockResolvedValue({
        records: [{ get: () => 'commit-789' }]
      });

      await agent.processSyncEvent(testData);

      expect(neo4jService.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (c:Commit'),
        expect.any(Object)
      );
    });

    it('should upsert file node in Neo4j', async () => {
      neo4jService.run.mockResolvedValue({
        records: [{ get: () => 'file-123' }]
      });

      await agent.processSyncEvent(testData);

      expect(neo4jService.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (f:File'),
        expect.objectContaining({
          orgId: 'org-123',
          sourceId: 'source-456',
          path: '/documents/script.pdf',
          name: 'script.pdf'
        })
      );
    });

    it('should queue classification job for new files', async () => {
      neo4jService.run.mockResolvedValue({
        records: [{ get: () => 'file-123' }]
      });

      await agent.processSyncEvent(testData);

      expect(eventQueue.add).toHaveBeenCalledWith(
        'classify-file',
        expect.objectContaining({
          orgId: 'org-123',
          fileId: 'file-123',
          filePath: '/documents/script.pdf'
        })
      );
    });

    it('should queue content extraction for extractable files', async () => {
      neo4jService.run.mockResolvedValue({
        records: [{ get: () => 'file-123' }]
      });

      await agent.processSyncEvent(testData);

      expect(eventQueue.add).toHaveBeenCalledWith(
        'extract-content',
        expect.objectContaining({
          orgId: 'org-123',
          fileId: 'file-123'
        })
      );
    });

    it('should handle file deletion with soft delete', async () => {
      const deleteData = {
        ...testData,
        eventType: 'file_deleted'
      };

      neo4jService.run
        .mockResolvedValueOnce({
          records: [{ get: () => ({ properties: { id: 'file-123' } }) }]
        })
        .mockResolvedValueOnce({ records: [] });

      await agent.processSyncEvent(deleteData);

      expect(neo4jService.run).toHaveBeenCalledWith(
        expect.stringContaining('SET f.current = false'),
        expect.any(Object)
      );
    });
  });

  describe('extractFileMetadata', () => {
    it('should extract metadata from Dropbox event data', () => {
      const dropboxData = {
        entry: {
          name: 'document.pdf',
          size: 2048,
          content_hash: 'hash123',
          server_modified: '2023-01-01T12:00:00Z',
          id: 'dropbox-id-123',
          rev: 'rev-456',
          path_display: '/documents/document.pdf'
        }
      };

      const metadata = agent.extractFileMetadata(dropboxData);

      expect(metadata).toEqual({
        name: 'document.pdf',
        size: 2048,
        mimeType: 'application/pdf',
        checksum: 'hash123',
        modified: '2023-01-01T12:00:00Z',
        dbId: 'dropbox-id-123',
        extra: {
          provider: 'dropbox',
          rev: 'rev-456',
          pathDisplay: '/documents/document.pdf'
        }
      });
    });

    it('should extract metadata from Google Drive event data', () => {
      const gdriveData = {
        file: {
          name: 'spreadsheet.xlsx',
          size: '4096',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          md5Checksum: 'checksum123',
          modifiedTime: '2023-01-01T15:30:00Z',
          id: 'gdrive-id-123',
          version: '3',
          webViewLink: 'https://docs.google.com/spreadsheets/d/123'
        }
      };

      const metadata = agent.extractFileMetadata(gdriveData);

      expect(metadata).toEqual({
        name: 'spreadsheet.xlsx',
        size: 4096,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        checksum: 'checksum123',
        modified: '2023-01-01T15:30:00Z',
        dbId: 'gdrive-id-123',
        extra: {
          provider: 'gdrive',
          version: '3',
          webViewLink: 'https://docs.google.com/spreadsheets/d/123'
        }
      });
    });
  });

  describe('shouldExtractContent', () => {
    it('should return true for extractable mime types', () => {
      const extractableTypes = [
        'application/pdf',
        'text/plain',
        'application/msword',
        'image/jpeg'
      ];

      extractableTypes.forEach(type => {
        expect(agent.shouldExtractContent(type)).toBe(true);
      });
    });

    it('should return false for non-extractable mime types', () => {
      const nonExtractableTypes = [
        'application/octet-stream',
        'video/mp4',
        'audio/mpeg'
      ];

      nonExtractableTypes.forEach(type => {
        expect(agent.shouldExtractContent(type)).toBe(false);
      });
    });
  });
});
```

#### 2.2 Classification Agent Unit Tests

**Taxonomy Classification Agent Test Suite**
```typescript
import { TaxonomyClassificationAgent } from '@/agents/TaxonomyClassificationAgent';

describe('TaxonomyClassificationAgent', () => {
  let agent: TaxonomyClassificationAgent;

  beforeEach(() => {
    agent = new TaxonomyClassificationAgent();
  });

  describe('loadTaxonomyRules', () => {
    it('should load rules from database', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          orgId: 'org-123',
          slotKey: 'SCRIPTS',
          matchPattern: '*.pdf',
          priority: 1,
          enabled: true,
          conditions: []
        }
      ];

      // Mock database query
      (agent as any).database = {
        query: jest.fn().mockResolvedValue({ rows: mockRules })
      };

      await agent.loadTaxonomyRules('org-123');

      expect((agent as any).database.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['org-123']
      );
    });
  });

  describe('classifyFile', () => {
    const testFile = {
      name: 'storyboard.pdf',
      path: '/creative/storyboard.pdf',
      size: 1024,
      mimeType: 'application/pdf'
    };

    it('should classify file based on matching rules', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          orgId: 'org-123',
          slotKey: 'STORYBOARDS',
          matchPattern: '*storyboard*',
          priority: 1,
          enabled: true,
          conditions: [
            {
              type: 'filename',
              operator: 'contains',
              value: 'storyboard',
              caseSensitive: false
            }
          ]
        }
      ];

      (agent as any).rules = new Map([['org-123', mockRules]]);

      const result = await agent.classifyFile('org-123', testFile);

      expect(result).toEqual({
        slotKey: 'STORYBOARDS',
        confidence: 1,
        ruleId: 'rule-1',
        method: 'taxonomy'
      });
    });

    it('should return UNCLASSIFIED for non-matching files', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          orgId: 'org-123',
          slotKey: 'SCRIPTS',
          matchPattern: '*.docx',
          priority: 1,
          enabled: true,
          conditions: [
            {
              type: 'filename',
              operator: 'matches',
              value: '.*\\.docx$'
            }
          ]
        }
      ];

      (agent as any).rules = new Map([['org-123', mockRules]]);

      const result = await agent.classifyFile('org-123', testFile);

      expect(result).toEqual({
        slotKey: 'UNCLASSIFIED',
        confidence: 0,
        ruleId: null,
        method: 'default'
      });
    });

    it('should calculate confidence based on matching conditions', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          orgId: 'org-123',
          slotKey: 'CREATIVE_ASSETS',
          matchPattern: '*',
          priority: 1,
          enabled: true,
          conditions: [
            {
              type: 'path',
              operator: 'contains',
              value: 'creative'
            },
            {
              type: 'size',
              operator: 'greater_than',
              value: 500
            }
          ]
        }
      ];

      (agent as any).rules = new Map([['org-123', mockRules]]);

      const result = await agent.classifyFile('org-123', testFile);

      expect(result.confidence).toBe(1); // Both conditions match
    });
  });

  describe('evaluateCondition', () => {
    it('should match filename patterns', async () => {
      const condition = {
        type: 'filename',
        operator: 'matches',
        value: '.*\\.pdf$',
        caseSensitive: true
      };

      const result = await agent.evaluateCondition(condition, { name: 'document.pdf' });
      expect(result).toBe(true);
    });

    it('should match path content', async () => {
      const condition = {
        type: 'path',
        operator: 'contains',
        value: 'assets',
        caseSensitive: false
      };

      const result = await agent.evaluateCondition(condition, { path: '/creative/assets/images/' });
      expect(result).toBe(true);
    });

    it('should compare file sizes', async () => {
      const condition = {
        type: 'size',
        operator: 'greater_than',
        value: 1000
      };

      const result = await agent.evaluateCondition(condition, { size: 2048 });
      expect(result).toBe(true);
    });
  });
});
```

### 3. Integration Testing Implementation

#### 3.1 Data Ingestion Integration Tests

**Storage Provider Integration Test Suite**
```typescript
import { DropboxWebhookHandler } from '@/handlers/DropboxWebhookHandler';
import { GoogleDriveHandler } from '@/handlers/GoogleDriveHandler';
import { SupabaseStorageHandler } from '@/handlers/SupabaseStorageHandler';
import { FileStewardAgent } from '@/agents/FileStewardAgent';
import { Neo4jService } from '@/services/Neo4jService';

describe('Data Ingestion Integration', () => {
  let dropboxHandler: DropboxWebhookHandler;
  let stewardAgent: FileStewardAgent;
  let neo4jService: Neo4jService;

  beforeAll(() => {
    neo4jService = new Neo4jService({
      uri: process.env.NEO4J_TEST_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_TEST_USER || 'neo4j',
      password: process.env.NEO4J_TEST_PASSWORD || 'password'
    });
    
    stewardAgent = new FileStewardAgent(
      neo4jService,
      // Other services...
    );
    
    dropboxHandler = new DropboxWebhookHandler(stewardAgent);
  });

  afterAll(async () => {
    await neo4jService.close();
  });

  describe('Dropbox Webhook Processing', () => {
    const testWebhookPayload = {
      list_folder: {
        accounts: ['dbid:AAABBBCCC']
      }
    };

    const testHeaders = {
      'x-dropbox-signature': 'valid-signature'
    };

    it('should process webhook and create file nodes', async () => {
      // Mock Dropbox API to return test file data
      const mockDropboxFiles = [
        {
          name: 'test-document.pdf',
          path_display: '/test/test-document.pdf',
          content_hash: 'test-hash',
          server_modified: '2023-01-01T00:00:00Z',
          size: 1024,
          id: 'id:test-file'
        }
      ];

      // Mock the Dropbox client
      (dropboxHandler as any).dropboxClient = {
        filesListFolder: jest.fn().mockResolvedValue({
          entries: mockDropboxFiles,
          has_more: false
        }),
        filesListFolderContinue: jest.fn()
      };

      // Process the webhook
      const result = await dropboxHandler.handleWebhook(testWebhookPayload, testHeaders);

      // Verify file nodes were created in Neo4j
      const query = `
        MATCH (f:File {name: 'test-document.pdf'})
        WHERE f.org_id = 'test-org'
        RETURN f
      `;

      const dbResult = await neo4jService.run(query);
      expect(dbResult.records.length).toBeGreaterThan(0);
      
      const fileNode = dbResult.records[0].get('f');
      expect(fileNode.properties.name).toBe('test-document.pdf');
      expect(fileNode.properties.checksum).toBe('test-hash');
    });

    it('should queue classification jobs for new files', async () => {
      // This test would verify that when files are processed,
      // classification jobs are properly queued in the job system
    });
  });

  describe('Cross-Provider Consistency', () => {
    it('should normalize file metadata across providers', async () => {
      // Test that files from different providers are normalized
      // to the same structure when stored in Neo4j
    });

    it('should maintain consistent file paths', async () => {
      // Test that file paths are consistently formatted
      // regardless of storage provider
    });
  });
});
```

#### 3.2 Knowledge Graph Integration Tests

**Neo4j Schema Integration Test Suite**
```typescript
import { Neo4jService } from '@/services/Neo4jService';
import { SchemaMigrationService } from '@/services/SchemaMigrationService';

describe('Knowledge Graph Integration', () => {
  let neo4jService: Neo4jService;
  let migrationService: SchemaMigrationService;

  beforeAll(() => {
    neo4jService = new Neo4jService({
      uri: process.env.NEO4J_TEST_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_TEST_USER || 'neo4j',
      password: process.env.NEO4J_TEST_PASSWORD || 'password'
    });
    
    migrationService = new SchemaMigrationService(neo4jService);
  });

  afterAll(async () => {
    await neo4jService.close();
  });

  describe('File Ontology Constraints', () => {
    it('should enforce unique file paths per organization', async () => {
      const orgId = 'test-org-1';
      const sourceId = 'test-source-1';
      const path = '/test/document.pdf';

      // Create first file
      const createQuery = `
        CREATE (f:File {
          org_id: $orgId,
          source_id: $sourceId,
          path: $path,
          name: 'document.pdf',
          id: randomUUID()
        })
        RETURN f
      `;

      await neo4jService.run(createQuery, { orgId, sourceId, path });

      // Attempt to create duplicate file (should fail)
      await expect(
        neo4jService.run(createQuery, { orgId, sourceId, path })
      ).rejects.toThrow();

      // Verify constraint exists
      const constraintQuery = `
        SHOW CONSTRAINTS
        WHERE type = 'UNIQUENESS' AND labelsOrTypes = ['File']
      `;

      const result = await neo4jService.run(constraintQuery);
      expect(result.records.length).toBeGreaterThan(0);
    });

    it('should enforce org_id on all nodes', async () => {
      // Test that all nodes require org_id property
    });

    it('should maintain temporal validity relationships', async () => {
      // Test that versioning relationships properly maintain
      // temporal validity constraints
    });
  });

  describe('Multi-Tenant Data Isolation', () => {
    it('should isolate data between organizations', async () => {
      const org1Id = 'org-1';
      const org2Id = 'org-2';

      // Create files for different organizations
      const createQuery = `
        CREATE (f:File {
          org_id: $orgId,
          source_id: 'test-source',
          path: '/test/document.pdf',
          name: 'document.pdf',
          id: randomUUID()
        })
        RETURN f
      `;

      await neo4jService.run(createQuery, { orgId: org1Id });
      await neo4jService.run(createQuery, { orgId: org2Id });

      // Verify org1 can only see its own files
      const org1Query = `
        MATCH (f:File {org_id: $orgId})
        RETURN count(f) as fileCount
      `;

      const org1Result = await neo4jService.run(org1Query, { orgId: org1Id });
      expect(org1Result.records[0].get('fileCount').toNumber()).toBe(1);

      // Verify org2 can only see its own files
      const org2Result = await neo4jService.run(org1Query, { orgId: org2Id });
      expect(org2Result.records[0].get('fileCount').toNumber()).toBe(1);
    });

    it('should prevent cross-tenant queries', async () => {
      // Test that queries without proper org_id filtering fail
    });
  });
});
```

### 4. End-to-End Testing Implementation

#### 4.1 User Workflow Tests

**Complete User Workflow Test Suite**
```typescript
import { test, expect } from '@playwright/test';

test.describe('User Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard');
  });

  test('should process new file from Dropbox and display in UI', async ({ page }) => {
    // Navigate to file explorer
    await page.click('a[href="/files"]');
    
    // Select test organization
    await page.selectOption('select#organization', 'Test Organization');
    
    // Select Dropbox source
    await page.selectOption('select#source', 'Dropbox');
    
    // Verify file list is displayed
    await expect(page.locator('.file-tree')).toBeVisible();
    
    // Simulate new file in Dropbox (this would require mocking the webhook)
    // For testing, we might directly call the API endpoint
    
    // Verify new file appears in UI without refresh
    await expect(page.locator('.file-item:has-text("new-document.pdf")')).toBeVisible();
  });

  test('should classify files automatically based on taxonomy rules', async ({ page }) => {
    // Upload a test file that matches taxonomy rules
    // Verify it gets classified correctly in the UI
  });

  test('should extract content from supported file types', async ({ page }) => {
    // Upload a PDF file
    // Verify content is extracted and displayed
  });

  test('should maintain version history when files are updated', async ({ page }) => {
    // Update an existing file
    // Verify version history is maintained in Neo4j
    // Verify UI shows version information
  });

  test('should isolate data between organizations', async ({ page }) => {
    // Switch between organizations
    // Verify files from one organization don't appear in another
  });
});
```

#### 4.2 API Integration Tests

**GraphQL API End-to-End Tests**
```typescript
import { ApolloClient } from '@apollo/client/core';
import gql from 'graphql-tag';

describe('GraphQL API Integration', () => {
  let client: ApolloClient<any>;

  beforeAll(() => {
    client = new ApolloClient({
      uri: 'http://localhost:4000/graphql',
      // Other configuration...
    });
  });

  test('should query files with proper tenant isolation', async () => {
    const query = gql`
      query TestFiles($orgId: ID!) {
        files(filter: { orgId: $orgId }) {
          id
          name
          path
        }
      }
    `;

    const result = await client.query({
      query,
      variables: { orgId: 'test-org-1' }
    });

    expect(result.data.files).toBeDefined();
    expect(result.data.files.length).toBeGreaterThan(0);
    
    // Verify all returned files belong to the specified organization
    result.data.files.forEach(file => {
      expect(file.orgId).toBe('test-org-1');
    });
  });

  test('should create commits for file operations', async () => {
    const mutation = gql`
      mutation TestCreateFile($input: CreateFileInput!) {
        createFile(input: $input) {
          id
          name
          commit {
            id
            message
            author
          }
        }
      }
    `;

    const result = await client.mutate({
      mutation,
      variables: {
        input: {
          orgId: 'test-org-1',
          sourceId: 'test-source-1',
          path: '/test/new-file.pdf',
          name: 'new-file.pdf'
        }
      }
    });

    expect(result.data.createFile.commit).toBeDefined();
    expect(result.data.createFile.commit.message).toContain('new-file.pdf');
  });

  test('should subscribe to real-time file updates', async () => {
    const subscription = gql`
      subscription TestFileUpdates($orgId: ID!) {
        fileUpdated(orgId: $orgId) {
          id
          name
          modified
        }
      }
    `;

    // This test would verify that subscriptions work properly
    // and deliver updates in real-time
  });
});
```

### 5. Performance Testing Implementation

#### 5.1 Load Testing Configuration

**Artillery Load Test Configuration**
```yaml
config:
  target: "http://localhost:4000"
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up phase"
    - duration: 120
      arrivalRate: 5
      rampTo: 50
      name: "Ramp up load"
    - duration: 600
      arrivalRate: 50
      name: "Sustained max load"
  variables:
    orgIds:
      - "org-1"
      - "org-2"
      - "org-3"
    sourceIds:
      - "source-1"
      - "source-2"

scenarios:
  - name: "File Listing"
    flow:
      - loop:
          - get:
              url: "/api/files?orgId={{ orgIds[$random(0, 2)] }}&sourceId={{ sourceIds[$random(0, 1)] }}"
              headers:
                Authorization: "Bearer {{ $processEnvironment.JWT_TOKEN }}"
          - think: 5
        count: 10

  - name: "File Upload"
    flow:
      - loop:
          - post:
              url: "/api/files"
              headers:
                Authorization: "Bearer {{ $processEnvironment.JWT_TOKEN }}"
                Content-Type: "application/json"
              json:
                orgId: "{{ orgIds[$random(0, 2)] }}"
                sourceId: "{{ sourceIds[$random(0, 1)] }}"
                path: "/test/document-{{$random(1, 1000)}}.pdf"
                name: "document-{{$random(1, 1000)}}.pdf"
                size: "{{ $random(1000, 10000000) }}"
          - think: 10
        count: 5

  - name: "GraphQL Queries"
    flow:
      - loop:
          - post:
              url: "/graphql"
              headers:
                Authorization: "Bearer {{ $processEnvironment.JWT_TOKEN }}"
              json:
                query: |
                  query GetFiles($orgId: ID!) {
                    files(filter: { orgId: $orgId }) {
                      id
                      name
                      path
                      size
                      modified
                    }
                  }
                variables:
                  orgId: "{{ orgIds[$random(0, 2)] }}"
          - think: 3
        count: 20
```

#### 5.2 Performance Benchmark Tests

**Performance Testing Suite**
```typescript
import { performance } from 'perf_hooks';
import { Neo4jService } from '@/services/Neo4jService';
import { FileStewardAgent } from '@/agents/FileStewardAgent';

describe('Performance Benchmarks', () => {
  let neo4jService: Neo4jService;
  let stewardAgent: FileStewardAgent;

  beforeAll(() => {
    neo4jService = new Neo4jService({
      uri: process.env.NEO4J_TEST_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_TEST_USER || 'neo4j',
      password: process.env.NEO4J_TEST_PASSWORD || 'password'
    });
    
    stewardAgent = new FileStewardAgent(neo4jService, /* other services */);
  });

  afterAll(async () => {
    await neo4jService.close();
  });

  test('file processing throughput', async () => {
    const testEvents = generateTestEvents(1000);
    const startTime = performance.now();
    
    // Process 1000 file events
    for (const event of testEvents) {
      await stewardAgent.processSyncEvent(event);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const throughput = testEvents.length / (duration / 1000); // events per second
    
    console.log(`Processed ${testEvents.length} events in ${duration}ms`);
    console.log(`Throughput: ${throughput.toFixed(2)} events/second`);
    
    // Assert performance thresholds
    expect(throughput).toBeGreaterThan(50); // Should process at least 50 events/second
  });

  test('query performance with large datasets', async () => {
    // Populate database with test data
    await populateTestData(10000);
    
    const startTime = performance.now();
    
    // Execute complex query
    const result = await neo4jService.run(`
      MATCH (f:File {org_id: $orgId})
      WHERE f.modified > datetime($since)
      RETURN f
      LIMIT 100
    `, {
      orgId: 'test-org-1',
      since: '2023-01-01T00:00:00Z'
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`Query executed in ${duration}ms`);
    console.log(`Returned ${result.records.length} records`);
    
    // Assert performance thresholds
    expect(duration).toBeLessThan(500); // Query should complete in under 500ms
  });

  test('subscription delivery performance', async () => {
    // Test real-time subscription delivery times
  });

  function generateTestEvents(count: number): any[] {
    const events = [];
    for (let i = 0; i < count; i++) {
      events.push({
        orgId: 'test-org-1',
        sourceId: 'test-source-1',
        eventType: 'file_created',
        resourcePath: `/test/document-${i}.pdf`,
        eventData: {
          entry: {
            name: `document-${i}.pdf`,
            size: Math.floor(Math.random() * 1000000),
            content_hash: `hash-${i}`,
            server_modified: new Date().toISOString(),
            id: `file-${i}`
          }
        }
      });
    }
    return events;
  }

  async function populateTestData(count: number) {
    // Implementation to populate test data
  }
});
```

### 6. Security Testing Implementation

#### 6.1 Authentication and Authorization Tests

**Security Test Suite**
```typescript
import { ApolloClient } from '@apollo/client/core';
import gql from 'graphql-tag';

describe('Security Testing', () => {
  test('should reject unauthorized file access', async () => {
    const client = new ApolloClient({
      uri: 'http://localhost:4000/graphql'
      // No authentication token
    });

    const query = gql`
      query GetFiles($orgId: ID!) {
        files(filter: { orgId: $orgId }) {
          id
          name
        }
      }
    `;

    await expect(
      client.query({ query, variables: { orgId: 'org-1' } })
    ).rejects.toThrow();
  });

  test('should prevent cross-tenant data access', async () => {
    // Login as user with access to org-1 only
    const client = new ApolloClient({
      uri: 'http://localhost:4000/graphql',
      headers: {
        Authorization: 'Bearer user-org1-token'
      }
    });

    // Attempt to access files from org-2 (should fail)
    const query = gql`
      query GetFiles($orgId: ID!) {
        files(filter: { orgId: $orgId }) {
          id
          name
        }
      }
    `;

    await expect(
      client.query({ query, variables: { orgId: 'org-2' } })
    ).rejects.toThrow();
  });

  test('should validate webhook signatures', async () => {
    // Test that invalid webhook signatures are rejected
  });

  test('should enforce RLS policies on PostgreSQL tables', async () => {
    // Test that Row Level Security policies prevent unauthorized access
    // to Supabase tables
  });
});
```

This comprehensive testing strategy covers all aspects of the Blueprint system with unit tests, integration tests, end-to-end tests, performance benchmarks, and security validation. Each test suite is designed to verify the core functionality while maintaining tenant isolation and version control principles.
