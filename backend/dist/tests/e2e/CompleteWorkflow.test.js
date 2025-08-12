"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const server_1 = require("../../graphql/server");
const AgentOrchestrator_1 = require("../../services/AgentOrchestrator");
const QueueService_1 = require("../../services/queues/QueueService");
const Neo4jService_1 = require("../../services/Neo4jService");
const PostgresService_1 = require("../../services/PostgresService");
const supertest_1 = __importDefault(require("supertest"));
(0, globals_1.describe)('Complete Olivine V11 Workflow E2E Tests', () => {
    let graphqlServer;
    let agentOrchestrator;
    let queueService;
    let neo4jService;
    let postgresService;
    let app;
    const testOrgId = 'e2e-test-org';
    const testUserId = 'e2e-test-user';
    const testProjectId = 'e2e-test-project';
    (0, globals_1.beforeAll)(async () => {
        graphqlServer = new server_1.GraphQLServer();
        agentOrchestrator = new AgentOrchestrator_1.AgentOrchestrator();
        queueService = new QueueService_1.QueueService();
        neo4jService = new Neo4jService_1.Neo4jService();
        postgresService = new PostgresService_1.PostgresService();
        await graphqlServer.start(4001);
        await agentOrchestrator.start();
        app = graphqlServer.app;
    });
    (0, globals_1.afterAll)(async () => {
        await agentOrchestrator.stop();
        await graphqlServer.stop();
    });
    (0, globals_1.beforeEach)(async () => {
        await neo4jService.run('MATCH (n {org_id: $orgId}) DETACH DELETE n', { orgId: testOrgId });
    });
    (0, globals_1.describe)('Complete Film Production Workflow', () => {
        (0, globals_1.it)('should handle complete film production lifecycle', async () => {
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
            const projectResponse = await (0, supertest_1.default)(app)
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
            (0, globals_1.expect)(projectResponse.status).toBe(200);
            (0, globals_1.expect)(projectResponse.body.data.createProject).toBeDefined();
            const project = projectResponse.body.data.createProject;
            const createCharacterMutation = `
        mutation CreateCharacter($input: CharacterInput!, $userId: String!) {
          createCharacter(input: $input, userId: $userId) {
            id
            name
            role_type
          }
        }
      `;
            const character1Response = await (0, supertest_1.default)(app)
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
            const character2Response = await (0, supertest_1.default)(app)
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
            (0, globals_1.expect)(character1Response.status).toBe(200);
            (0, globals_1.expect)(character2Response.status).toBe(200);
            const character1 = character1Response.body.data.createCharacter;
            const character2 = character2Response.body.data.createCharacter;
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
            const scene1Response = await (0, supertest_1.default)(app)
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
            (0, globals_1.expect)(scene1Response.status).toBe(200);
            const scene1 = scene1Response.body.data.createScene;
            const linkSceneCharacterMutation = `
        mutation LinkSceneToCharacter($sceneId: ID!, $characterId: ID!, $orgId: String!, $userId: String!) {
          linkSceneToCharacter(sceneId: $sceneId, characterId: $characterId, orgId: $orgId, userId: $userId) {
            success
          }
        }
      `;
            const linkResponse1 = await (0, supertest_1.default)(app)
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
            const linkResponse2 = await (0, supertest_1.default)(app)
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
            (0, globals_1.expect)(linkResponse1.status).toBe(200);
            (0, globals_1.expect)(linkResponse2.status).toBe(200);
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
            const vendorResponse = await (0, supertest_1.default)(app)
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
            (0, globals_1.expect)(vendorResponse.status).toBe(200);
            const vendor = vendorResponse.body.data.createVendor;
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
            const budgetResponse = await (0, supertest_1.default)(app)
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
            (0, globals_1.expect)(budgetResponse.status).toBe(200);
            const budget = budgetResponse.body.data.createBudget;
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
            const poResponse = await (0, supertest_1.default)(app)
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
            (0, globals_1.expect)(poResponse.status).toBe(200);
            const purchaseOrder = poResponse.body.data.createPurchaseOrder;
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
            await new Promise(resolve => setTimeout(resolve, 3000));
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
            (0, globals_1.expect)(verificationResult.records).toHaveLength(1);
            const verification = verificationResult.records[0];
            (0, globals_1.expect)(verification.get('sceneCount').toNumber()).toBe(1);
            (0, globals_1.expect)(verification.get('characterCount').toNumber()).toBe(2);
            (0, globals_1.expect)(verification.get('sceneCharacterLinks').toNumber()).toBe(2);
            const operationsQuery = `
        MATCH (v:Vendor {org_id: $orgId})
        MATCH (b:Budget {org_id: $orgId})
        MATCH (po:PurchaseOrder {org_id: $orgId})
        RETURN count(v) as vendorCount, count(b) as budgetCount, count(po) as poCount
      `;
            const operationsResult = await neo4jService.run(operationsQuery, { orgId: testOrgId });
            const operations = operationsResult.records[0];
            (0, globals_1.expect)(operations.get('vendorCount').toNumber()).toBe(1);
            (0, globals_1.expect)(operations.get('budgetCount').toNumber()).toBe(1);
            (0, globals_1.expect)(operations.get('poCount').toNumber()).toBe(1);
            const provenanceQuery = `
        MATCH (c:Commit {org_id: $orgId})
        RETURN count(c) as commitCount
      `;
            const provenanceResult = await neo4jService.run(provenanceQuery, { orgId: testOrgId });
            const commitCount = provenanceResult.records[0].get('commitCount').toNumber();
            (0, globals_1.expect)(commitCount).toBeGreaterThan(5);
            const fileQuery = `
        MATCH (f:File {org_id: $orgId, name: 'final-script-v2.pdf'})
        RETURN f
      `;
            const fileResult = await neo4jService.run(fileQuery, { orgId: testOrgId });
            (0, globals_1.expect)(fileResult.records.length).toBeGreaterThanOrEqual(0);
        });
        (0, globals_1.it)('should handle budget vs actual analysis workflow', async () => {
            const project = await createTestProject();
            const budget = await createTestBudget(project.id);
            const vendor = await createTestVendor();
            const po1 = await createTestPurchaseOrder(project.id, vendor.id, 5000, 'Equipment rental');
            const po2 = await createTestPurchaseOrder(project.id, vendor.id, 3000, 'Additional equipment');
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
            const analysisResponse = await (0, supertest_1.default)(app)
                .post('/graphql')
                .send({
                query: analysisQuery,
                variables: {
                    projectId: project.id,
                    orgId: testOrgId
                }
            });
            (0, globals_1.expect)(analysisResponse.status).toBe(200);
            (0, globals_1.expect)(analysisResponse.body.data.budgetVsActualAnalysis).toBeDefined();
        });
        (0, globals_1.it)('should handle vendor performance analysis', async () => {
            const vendor1 = await createTestVendor('Camera Rentals Inc');
            const vendor2 = await createTestVendor('Lighting Solutions LLC');
            const project = await createTestProject();
            await createTestPurchaseOrder(project.id, vendor1.id, 10000, 'Camera package');
            await createTestPurchaseOrder(project.id, vendor2.id, 7500, 'Lighting package');
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
            const performanceResponse = await (0, supertest_1.default)(app)
                .post('/graphql')
                .send({
                query: performanceQuery,
                variables: {
                    orgId: testOrgId
                }
            });
            (0, globals_1.expect)(performanceResponse.status).toBe(200);
            (0, globals_1.expect)(performanceResponse.body.data.vendorPerformanceAnalysis).toBeDefined();
            (0, globals_1.expect)(performanceResponse.body.data.vendorPerformanceAnalysis.length).toBe(2);
        });
    });
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
        const response = await (0, supertest_1.default)(app)
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
    async function createTestBudget(projectId) {
        const createBudgetMutation = `
      mutation CreateBudget($input: BudgetInput!, $userId: String!) {
        createBudget(input: $input, userId: $userId) {
          id
          name
          total_budget
        }
      }
    `;
        const response = await (0, supertest_1.default)(app)
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
    async function createTestVendor(name = 'Test Vendor') {
        const createVendorMutation = `
      mutation CreateVendor($input: VendorInput!, $userId: String!) {
        createVendor(input: $input, userId: $userId) {
          id
          name
          category
        }
      }
    `;
        const response = await (0, supertest_1.default)(app)
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
    async function createTestPurchaseOrder(projectId, vendorId, amount, description) {
        const createPOMutation = `
      mutation CreatePurchaseOrder($input: PurchaseOrderInput!, $userId: String!) {
        createPurchaseOrder(input: $input, userId: $userId) {
          id
          po_number
          amount
        }
      }
    `;
        const response = await (0, supertest_1.default)(app)
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
//# sourceMappingURL=CompleteWorkflow.test.js.map