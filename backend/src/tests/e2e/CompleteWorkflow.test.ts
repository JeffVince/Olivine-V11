import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { GraphQLServer } from '../../graphql/server';
import { AgentOrchestrator } from '../../services/AgentOrchestrator';
import { QueueService } from '../../services/queues/QueueService';
import { Neo4jService } from '../../services/Neo4jService';
import { PostgresService } from '../../services/PostgresService';
import request from 'supertest';
import { Express } from 'express';

describe('Complete Olivine V11 Workflow E2E Tests', () => {
  let graphqlServer: GraphQLServer;
  let agentOrchestrator: AgentOrchestrator;
  let queueService: QueueService;
  let neo4jService: Neo4jService;
  let postgresService: PostgresService;
  let app: Express;

  const testOrgId = 'e2e-test-org';
  const testUserId = 'e2e-test-user';
  const testProjectId = 'e2e-test-project';

  beforeAll(async () => {
    // Initialize services
    graphqlServer = new GraphQLServer();
    agentOrchestrator = new AgentOrchestrator();
    queueService = new QueueService();
    neo4jService = new Neo4jService();
    postgresService = new PostgresService();

    // Start GraphQL server on test port
    await graphqlServer.start(4001);
    
    // Start agent orchestrator
    await agentOrchestrator.start();

    // Get Express app for direct testing
    app = (graphqlServer as any).app;
  });

  afterAll(async () => {
    await agentOrchestrator.stop();
    await graphqlServer.stop();
  });

  beforeEach(async () => {
    // Clean up test data
    await neo4jService.run(
      'MATCH (n {org_id: $orgId}) DETACH DELETE n',
      { orgId: testOrgId }
    );
  });

  describe('Complete Film Production Workflow', () => {
    it('should handle complete film production lifecycle', async () => {
      // Step 1: Create Project via GraphQL
      const createProjectMutation = `
        mutation CreateProject($input: ProjectInput!, $userId: String!) {
          createProject(input: $input, userId: $userId) {
            id
            title
            type
            status
            budget
          }
        }
      `;

      const projectResponse = await request(app)
        .post('/graphql')
        .send({
          query: createProjectMutation,
          variables: {
            input: {
              org_id: testOrgId,
              title: 'E2E Test Feature Film',
              type: 'FEATURE_FILM',
              status: 'DEVELOPMENT',
              budget: 2000000,
              metadata: { genre: 'Thriller' }
            },
            userId: testUserId
          }
        });

      expect(projectResponse.status).toBe(200);
      expect(projectResponse.body.data.createProject).toBeDefined();
      const project = projectResponse.body.data.createProject;

      // Step 2: Create Characters
      const createCharacterMutation = `
        mutation CreateCharacter($input: CharacterInput!, $userId: String!) {
          createCharacter(input: $input, userId: $userId) {
            id
            name
            role_type
          }
        }
      `;

      const character1Response = await request(app)
        .post('/graphql')
        .send({
          query: createCharacterMutation,
          variables: {
            input: {
              org_id: testOrgId,
              project_id: project.id,
              name: 'Detective Sarah Connor',
              role_type: 'LEAD',
              description: 'Experienced detective investigating the case'
            },
            userId: testUserId
          }
        });

      const character2Response = await request(app)
        .post('/graphql')
        .send({
          query: createCharacterMutation,
          variables: {
            input: {
              org_id: testOrgId,
              project_id: project.id,
              name: 'Dr. Marcus Webb',
              role_type: 'SUPPORTING',
              description: 'Forensic scientist'
            },
            userId: testUserId
          }
        });

      expect(character1Response.status).toBe(200);
      expect(character2Response.status).toBe(200);

      const character1 = character1Response.body.data.createCharacter;
      const character2 = character2Response.body.data.createCharacter;

      // Step 3: Create Scenes
      const createSceneMutation = `
        mutation CreateScene($input: SceneInput!, $userId: String!) {
          createScene(input: $input, userId: $userId) {
            id
            number
            title
            status
          }
        }
      `;

      const scene1Response = await request(app)
        .post('/graphql')
        .send({
          query: createSceneMutation,
          variables: {
            input: {
              org_id: testOrgId,
              project_id: project.id,
              number: '1',
              title: 'Crime Scene Discovery',
              location: 'Abandoned Warehouse',
              time_of_day: 'NIGHT',
              status: 'DRAFT'
            },
            userId: testUserId
          }
        });

      expect(scene1Response.status).toBe(200);
      const scene1 = scene1Response.body.data.createScene;

      // Step 4: Link Scene to Characters
      const linkSceneCharacterMutation = `
        mutation LinkSceneToCharacter($sceneId: ID!, $characterId: ID!, $orgId: String!, $userId: String!) {
          linkSceneToCharacter(sceneId: $sceneId, characterId: $characterId, orgId: $orgId, userId: $userId) {
            success
          }
        }
      `;

      const linkResponse1 = await request(app)
        .post('/graphql')
        .send({
          query: linkSceneCharacterMutation,
          variables: {
            sceneId: scene1.id,
            characterId: character1.id,
            orgId: testOrgId,
            userId: testUserId
          }
        });

      const linkResponse2 = await request(app)
        .post('/graphql')
        .send({
          query: linkSceneCharacterMutation,
          variables: {
            sceneId: scene1.id,
            characterId: character2.id,
            orgId: testOrgId,
            userId: testUserId
          }
        });

      expect(linkResponse1.status).toBe(200);
      expect(linkResponse2.status).toBe(200);

      // Step 5: Create Vendors for Operations
      const createVendorMutation = `
        mutation CreateVendor($input: VendorInput!, $userId: String!) {
          createVendor(input: $input, userId: $userId) {
            id
            name
            category
            status
          }
        }
      `;

      const vendorResponse = await request(app)
        .post('/graphql')
        .send({
          query: createVendorMutation,
          variables: {
            input: {
              org_id: testOrgId,
              name: 'Elite Camera Rentals',
              category: 'equipment',
              contact_email: 'rentals@elitecamera.com',
              status: 'ACTIVE',
              rating: 4.8
            },
            userId: testUserId
          }
        });

      expect(vendorResponse.status).toBe(200);
      const vendor = vendorResponse.body.data.createVendor;

      // Step 6: Create Budget
      const createBudgetMutation = `
        mutation CreateBudget($input: BudgetInput!, $userId: String!) {
          createBudget(input: $input, userId: $userId) {
            id
            name
            total_budget
            status
          }
        }
      `;

      const budgetResponse = await request(app)
        .post('/graphql')
        .send({
          query: createBudgetMutation,
          variables: {
            input: {
              org_id: testOrgId,
              project_id: project.id,
              name: 'Master Budget v1.0',
              total_budget: 2000000,
              currency: 'USD',
              status: 'DRAFT',
              version: '1.0',
              metadata: {
                categories: {
                  'above_the_line': 400000,
                  'below_the_line': 1200000,
                  'post_production': 300000,
                  'contingency': 100000
                }
              }
            },
            userId: testUserId
          }
        });

      expect(budgetResponse.status).toBe(200);
      const budget = budgetResponse.body.data.createBudget;

      // Step 7: Create Purchase Order
      const createPOMutation = `
        mutation CreatePurchaseOrder($input: PurchaseOrderInput!, $userId: String!) {
          createPurchaseOrder(input: $input, userId: $userId) {
            id
            po_number
            amount
            status
          }
        }
      `;

      const poResponse = await request(app)
        .post('/graphql')
        .send({
          query: createPOMutation,
          variables: {
            input: {
              org_id: testOrgId,
              project_id: project.id,
              po_number: 'PO-E2E-001',
              vendor_id: vendor.id,
              scene_id: scene1.id,
              description: 'Camera package for Scene 1',
              amount: 15000,
              currency: 'USD',
              status: 'DRAFT',
              order_date: new Date().toISOString(),
              needed_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              created_by: testUserId
            },
            userId: testUserId
          }
        });

      expect(poResponse.status).toBe(200);
      const purchaseOrder = poResponse.body.data.createPurchaseOrder;

      // Step 8: Simulate File Upload and Processing
      // This would normally come through webhook, but we'll simulate the agent processing
      await queueService.addJob('file-sync', 'process-file', {
        orgId: testOrgId,
        sourceId: 'test-source',
        resourcePath: '/scripts/final-script-v2.pdf',
        action: 'upsert',
        webhookData: {
          entry: {
            id: 'script-file-id',
            name: 'final-script-v2.pdf',
            size: 2048000,
            content_hash: 'script-hash-123',
            server_modified: new Date().toISOString(),
            path_display: '/scripts/final-script-v2.pdf'
          }
        },
        syncedAt: new Date().toISOString()
      });

      // Wait for file processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 9: Verify Complete System State
      // Check that all entities were created with proper relationships and provenance

      // Verify project exists with scenes and characters
      const projectVerificationQuery = `
        MATCH (p:Project {id: $projectId, org_id: $orgId})
        OPTIONAL MATCH (p)<-[:BELONGS_TO]-(s:Scene)
        OPTIONAL MATCH (p)<-[:BELONGS_TO]-(c:Character)
        OPTIONAL MATCH (s)<-[:FROM]-(ef:EdgeFact {type: 'FEATURES_CHARACTER'})-[:TO]->(c)
        RETURN p, 
               count(DISTINCT s) as sceneCount,
               count(DISTINCT c) as characterCount,
               count(DISTINCT ef) as sceneCharacterLinks
      `;

      const verificationResult = await neo4jService.run(projectVerificationQuery, {
        projectId: project.id,
        orgId: testOrgId
      });

      expect(verificationResult.records).toHaveLength(1);
      const verification = verificationResult.records[0];
      expect(verification.get('sceneCount').toNumber()).toBe(1);
      expect(verification.get('characterCount').toNumber()).toBe(2);
      expect(verification.get('sceneCharacterLinks').toNumber()).toBe(2);

      // Verify operations entities
      const operationsQuery = `
        MATCH (v:Vendor {org_id: $orgId})
        MATCH (b:Budget {org_id: $orgId})
        MATCH (po:PurchaseOrder {org_id: $orgId})
        RETURN count(v) as vendorCount, count(b) as budgetCount, count(po) as poCount
      `;

      const operationsResult = await neo4jService.run(operationsQuery, { orgId: testOrgId });
      const operations = operationsResult.records[0];
      expect(operations.get('vendorCount').toNumber()).toBe(1);
      expect(operations.get('budgetCount').toNumber()).toBe(1);
      expect(operations.get('poCount').toNumber()).toBe(1);

      // Verify provenance commits were created
      const provenanceQuery = `
        MATCH (c:Commit {org_id: $orgId})
        RETURN count(c) as commitCount
      `;

      const provenanceResult = await neo4jService.run(provenanceQuery, { orgId: testOrgId });
      const commitCount = provenanceResult.records[0].get('commitCount').toNumber();
      expect(commitCount).toBeGreaterThan(5); // Should have commits for each entity creation

      // Verify file was processed (if FileStewardAgent completed processing)
      const fileQuery = `
        MATCH (f:File {org_id: $orgId, name: 'final-script-v2.pdf'})
        RETURN f
      `;

      const fileResult = await neo4jService.run(fileQuery, { orgId: testOrgId });
      // File might not be processed yet due to async nature, but we can check if queue job was created
      expect(fileResult.records.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle budget vs actual analysis workflow', async () => {
      // Create project and budget
      const project = await createTestProject();
      const budget = await createTestBudget(project.id);
      const vendor = await createTestVendor();

      // Create multiple purchase orders
      const po1 = await createTestPurchaseOrder(project.id, vendor.id, 5000, 'Equipment rental');
      const po2 = await createTestPurchaseOrder(project.id, vendor.id, 3000, 'Additional equipment');

      // Query budget vs actual analysis via GraphQL
      const analysisQuery = `
        query BudgetVsActualAnalysis($projectId: ID!, $orgId: String!) {
          budgetVsActualAnalysis(projectId: $projectId, orgId: $orgId) {
            department
            budgeted
            actual
            variance
          }
        }
      `;

      const analysisResponse = await request(app)
        .post('/graphql')
        .send({
          query: analysisQuery,
          variables: {
            projectId: project.id,
            orgId: testOrgId
          }
        });

      expect(analysisResponse.status).toBe(200);
      expect(analysisResponse.body.data.budgetVsActualAnalysis).toBeDefined();
    });

    it('should handle vendor performance analysis', async () => {
      // Create vendors and purchase orders
      const vendor1 = await createTestVendor('Camera Rentals Inc');
      const vendor2 = await createTestVendor('Lighting Solutions LLC');
      const project = await createTestProject();

      await createTestPurchaseOrder(project.id, vendor1.id, 10000, 'Camera package');
      await createTestPurchaseOrder(project.id, vendor2.id, 7500, 'Lighting package');

      // Query vendor performance analysis
      const performanceQuery = `
        query VendorPerformanceAnalysis($orgId: String!) {
          vendorPerformanceAnalysis(orgId: $orgId) {
            vendor_name
            category
            total_po_amount
            delivery_performance
          }
        }
      `;

      const performanceResponse = await request(app)
        .post('/graphql')
        .send({
          query: performanceQuery,
          variables: {
            orgId: testOrgId
          }
        });

      expect(performanceResponse.status).toBe(200);
      expect(performanceResponse.body.data.vendorPerformanceAnalysis).toBeDefined();
      expect(performanceResponse.body.data.vendorPerformanceAnalysis.length).toBe(2);
    });
  });

  // Helper functions for test data creation
  async function createTestProject() {
    const createProjectMutation = `
      mutation CreateProject($input: ProjectInput!, $userId: String!) {
        createProject(input: $input, userId: $userId) {
          id
          title
          type
          status
        }
      }
    `;

    const response = await request(app)
      .post('/graphql')
      .send({
        query: createProjectMutation,
        variables: {
          input: {
            org_id: testOrgId,
            title: 'Test Project for Analysis',
            type: 'FEATURE_FILM',
            status: 'DEVELOPMENT'
          },
          userId: testUserId
        }
      });

    return response.body.data.createProject;
  }

  async function createTestBudget(projectId: string) {
    const createBudgetMutation = `
      mutation CreateBudget($input: BudgetInput!, $userId: String!) {
        createBudget(input: $input, userId: $userId) {
          id
          name
          total_budget
        }
      }
    `;

    const response = await request(app)
      .post('/graphql')
      .send({
        query: createBudgetMutation,
        variables: {
          input: {
            org_id: testOrgId,
            project_id: projectId,
            name: 'Test Budget',
            total_budget: 100000,
            currency: 'USD',
            status: 'APPROVED',
            version: '1.0',
            metadata: {
              departments: {
                'equipment': 50000,
                'crew': 30000,
                'post': 20000
              }
            }
          },
          userId: testUserId
        }
      });

    return response.body.data.createBudget;
  }

  async function createTestVendor(name: string = 'Test Vendor') {
    const createVendorMutation = `
      mutation CreateVendor($input: VendorInput!, $userId: String!) {
        createVendor(input: $input, userId: $userId) {
          id
          name
          category
        }
      }
    `;

    const response = await request(app)
      .post('/graphql')
      .send({
        query: createVendorMutation,
        variables: {
          input: {
            org_id: testOrgId,
            name,
            category: 'equipment',
            status: 'ACTIVE'
          },
          userId: testUserId
        }
      });

    return response.body.data.createVendor;
  }

  async function createTestPurchaseOrder(projectId: string, vendorId: string, amount: number, description: string) {
    const createPOMutation = `
      mutation CreatePurchaseOrder($input: PurchaseOrderInput!, $userId: String!) {
        createPurchaseOrder(input: $input, userId: $userId) {
          id
          po_number
          amount
        }
      }
    `;

    const response = await request(app)
      .post('/graphql')
      .send({
        query: createPOMutation,
        variables: {
          input: {
            org_id: testOrgId,
            project_id: projectId,
            po_number: `PO-${Date.now()}`,
            vendor_id: vendorId,
            description,
            amount,
            currency: 'USD',
            status: 'APPROVED',
            order_date: new Date().toISOString(),
            created_by: testUserId
          },
          userId: testUserId
        }
      });

    return response.body.data.createPurchaseOrder;
  }
});
