"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphqlServer = exports.GraphQLServer = void 0;
const server_1 = require("@apollo/server");
const express4_1 = require("@as-integrations/express4");
const drainHttpServer_1 = require("@apollo/server/plugin/drainHttpServer");
const default_1 = require("@apollo/server/plugin/landingPage/default");
const schema_1 = require("@graphql-tools/schema");
const ws_1 = require("ws");
const graphql_subscriptions_1 = require("graphql-subscriptions");
const http_1 = require("http");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = require("fs");
const path_1 = require("path");
const graphql_1 = require("graphql");
const SecurityMiddleware_1 = require("./middleware/SecurityMiddleware");
const core_1 = require("./resolvers/core");
const ContentOntologyResolvers_1 = require("./resolvers/ContentOntologyResolvers");
const OperationsResolvers_1 = require("./resolvers/OperationsResolvers");
const Neo4jService_1 = require("../services/Neo4jService");
const PostgresService_1 = require("../services/PostgresService");
const QueueService_1 = require("../services/queues/QueueService");
const winston_1 = __importDefault(require("winston"));
class GraphQLServer {
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    constructor() {
        this.app = (0, express_1.default)();
        this.httpServer = (0, http_1.createServer)(this.app);
        this.securityMiddleware = new SecurityMiddleware_1.SecurityMiddleware();
        this.pubSub = new graphql_subscriptions_1.PubSub();
        this.neo4jService = new Neo4jService_1.Neo4jService();
        this.postgresService = new PostgresService_1.PostgresService();
        if (process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'test') {
            process.env.USE_IN_MEMORY_QUEUES = 'true';
        }
        this.queueService = new QueueService_1.QueueService();
        this.logger = winston_1.default.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json(), winston_1.default.format.label({ label: 'graphql-server' })),
            transports: [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                }),
                new winston_1.default.transports.File({
                    filename: 'logs/graphql-server.log',
                    format: winston_1.default.format.json()
                })
            ]
        });
    }
    async start(port = 4000) {
        try {
            await this.initializeServices();
            const schema = await this.createSchema();
            this.setupWebSocketServer(schema);
            await this.createApolloServer(schema);
            this.setupExpressMiddleware();
            await new Promise((resolve) => {
                this.httpServer.listen(port, () => {
                    this.logger.info(`🚀 GraphQL Server ready at http://localhost:${port}/graphql`);
                    this.logger.info(`🚀 GraphQL Subscriptions ready at ws://localhost:${port}/graphql`);
                    resolve();
                });
            });
        }
        catch (error) {
            this.logger.error('Failed to start GraphQL server:', error);
            throw error;
        }
    }
    async stop() {
        try {
            this.logger.info('Shutting down GraphQL server...');
            if (this.wsServer) {
                this.wsServer.close();
            }
            if (this.apolloServer) {
                await this.apolloServer.stop();
            }
            await new Promise((resolve) => {
                this.httpServer.close(() => resolve());
            });
            await this.neo4jService.close();
            await this.postgresService.close();
            await this.queueService.close();
            this.logger.info('GraphQL server stopped successfully');
        }
        catch (error) {
            this.logger.error('Error stopping GraphQL server:', error);
            throw error;
        }
    }
    async initializeServices() {
        this.logger.info('Initializing services...');
        try {
            await this.neo4jService.connect();
            this.logger.info('Neo4j connected');
            await this.postgresService.connect();
            this.logger.info('PostgreSQL connected');
            await this.queueService.connect();
            this.logger.info('Queue service connected');
            await this.createNeo4jIndexes();
        }
        catch (error) {
            this.logger.error('Failed to initialize services:', error);
            throw error;
        }
    }
    async createSchema() {
        this.logger.info('Creating GraphQL schema...');
        const schemaPath = __dirname.includes('/dist/')
            ? (0, path_1.join)(__dirname, 'schema')
            : (0, path_1.join)(process.cwd(), 'dist', 'graphql', 'schema');
        let enhancedTypeDefs = '';
        try {
            enhancedTypeDefs = (0, fs_1.readFileSync)((0, path_1.join)(schemaPath, 'enhanced.graphql'), 'utf8');
        }
        catch {
            enhancedTypeDefs = '';
        }
        const coreTypeDefs = (0, fs_1.readFileSync)((0, path_1.join)(schemaPath, 'core.graphql'), 'utf8');
        const e2eExtensions = `
      scalar DateTime
      scalar JSON

      input ProjectInput {
        org_id: String!
        title: String!
        type: String!
        status: String!
        start_date: DateTime
        budget: Float
        metadata: JSON
      }

      input CharacterInput {
        org_id: String!
        project_id: String!
        name: String!
        role_type: String!
        description: String
      }

      input SceneInput {
        org_id: String!
        project_id: String!
        number: String!
        title: String!
        location: String
        time_of_day: String
        status: String!
        page_count: Float
        description: String
      }

      input VendorInput {
        org_id: String!
        name: String!
        category: String
        contact_email: String
        status: String!
        rating: Float
      }

      input BudgetInput {
        org_id: String!
        project_id: String!
        name: String!
        total_budget: Float!
        currency: String!
        status: String!
        version: String!
        metadata: JSON
      }

      input PurchaseOrderInput {
        org_id: String!
        project_id: String!
        po_number: String!
        vendor_id: String!
        scene_id: String
        description: String
        amount: Float!
        currency: String!
        status: String!
        order_date: DateTime
        needed_date: DateTime
        delivery_address: String
        approved_by: String
        created_by: String!
      }
      extend type Project {
        title: String
        type: String
        budget: Float
      }

      extend type Mutation {
        createProject(input: ProjectInput!, userId: String!): Project!
        createCharacter(input: CharacterInput!, userId: String!): Character!
        createScene(input: SceneInput!, userId: String!): Scene!
        createVendor(input: VendorInput!, userId: String!): Vendor!
        createBudget(input: BudgetInput!, userId: String!): Budget!
        createPurchaseOrder(input: PurchaseOrderInput!, userId: String!): PurchaseOrder!
      }
    `;
        const typeDefs = `
      ${enhancedTypeDefs}
      ${coreTypeDefs}
      ${e2eExtensions}
    `;
        const coreResolvers = (0, core_1.buildCoreResolvers)();
        const contentResolvers = ContentOntologyResolvers_1.contentOntologyResolvers;
        const opsResolvers = OperationsResolvers_1.operationsResolvers;
        const resolvers = {
            ...coreResolvers,
            Query: {
                ...coreResolvers.Query,
                ...contentResolvers.Query,
                ...opsResolvers.Query,
            },
            Mutation: {
                ...coreResolvers.Mutation,
                ...contentResolvers.Mutation,
                ...opsResolvers.Mutation,
            },
        };
        return (0, schema_1.makeExecutableSchema)({
            typeDefs,
            resolvers
        });
    }
    async setupWebSocketServer(schema) {
        this.logger.info('Setting up WebSocket server...');
        this.wsServer = new ws_1.WebSocketServer({
            server: this.httpServer,
            path: '/graphql'
        });
        const { useServer } = await Promise.resolve().then(() => __importStar(require('graphql-ws/use/ws')));
        useServer({
            schema,
            context: async (ctx) => {
                try {
                    const rawReq = ctx.extra?.request;
                    const connectionParams = ctx.connectionParams || {};
                    const reqShim = {
                        ...rawReq,
                        headers: {
                            ...(rawReq?.headers || {}),
                            ...(connectionParams && typeof connectionParams === 'object' ? connectionParams : {})
                        },
                        get: (name) => {
                            const key = name.toLowerCase();
                            const headers = reqShim.headers || {};
                            return headers[name] || headers[key];
                        }
                    };
                    const resShim = ctx.extra?.response || {};
                    return await this.securityMiddleware.createContext({
                        req: reqShim,
                        res: resShim
                    });
                }
                catch (error) {
                    this.logger.error('WebSocket context creation failed:', error);
                    throw error;
                }
            },
            onConnect: async (ctx) => {
                this.logger.info('WebSocket client connected', {
                    connectionParams: ctx.connectionParams
                });
            },
            onDisconnect: async (ctx) => {
                this.logger.info('WebSocket client disconnected');
            },
            onError: (ctx, id, payload, errors) => {
                this.logger.error('WebSocket error:', { id, payload, errors });
            }
        }, this.wsServer);
    }
    async createApolloServer(schema) {
        this.logger.info('Creating Apollo Server...');
        this.apolloServer = new server_1.ApolloServer({
            schema,
            plugins: [
                (0, drainHttpServer_1.ApolloServerPluginDrainHttpServer)({ httpServer: this.httpServer }),
                process.env.NODE_ENV === 'production'
                    ? (0, default_1.ApolloServerPluginLandingPageLocalDefault)({ footer: false })
                    : (0, default_1.ApolloServerPluginLandingPageLocalDefault)(),
                {
                    async requestDidStart() {
                        const logger = this.logger || global.logger || console;
                        return {
                            async didResolveOperation(requestContext) {
                                logger?.debug?.('GraphQL operation resolved', {
                                    operationName: requestContext.request.operationName,
                                    query: requestContext.request.query
                                });
                            },
                            async didEncounterErrors(requestContext) {
                                logger?.error?.('GraphQL errors encountered', {
                                    operationName: requestContext.request.operationName,
                                    errors: requestContext.errors
                                });
                            }
                        };
                    }
                },
                {
                    async requestDidStart() {
                        const startTime = Date.now();
                        const logger = this.logger || global.logger || console;
                        return {
                            async willSendResponse(requestContext) {
                                const duration = Date.now() - startTime;
                                logger?.info?.('GraphQL request completed', {
                                    operationName: requestContext.request.operationName,
                                    duration: `${duration}ms`,
                                    success: !requestContext.errors?.length
                                });
                            }
                        };
                    }
                }
            ],
            formatError: (error) => {
                if (error instanceof Error) {
                    this.logger.error('GraphQL Error:', {
                        message: error.message,
                        locations: 'locations' in error ? error.locations : undefined,
                        path: 'path' in error ? error.path : undefined,
                        extensions: 'extensions' in error ? error.extensions : undefined
                    });
                }
                else {
                    this.logger.error('GraphQL Error:', { error });
                }
                if (process.env.NODE_ENV === 'production') {
                    if ('extensions' in error && error.extensions?.code === 'INTERNAL_SERVER_ERROR') {
                        return new graphql_1.GraphQLError('Internal server error');
                    }
                }
                return error;
            },
            introspection: process.env.NODE_ENV !== 'production',
            includeStacktraceInErrorResponses: process.env.NODE_ENV !== 'production'
        });
        await this.apolloServer.start();
    }
    setupExpressMiddleware() {
        this.logger.info('Setting up Express middleware...');
        this.app.use('/graphql', (0, cors_1.default)({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true
        }));
        this.app.use('/graphql', express_1.default.json({ limit: '10mb' }));
        this.app.get('/health', async (req, res) => {
            try {
                const neo4jStatus = await this.checkNeo4jHealth();
                const postgresStatus = await this.checkPostgresHealth();
                const queueStatus = await this.checkQueueHealth();
                const isHealthy = neo4jStatus && postgresStatus && queueStatus;
                res.status(isHealthy ? 200 : 503).json({
                    status: isHealthy ? 'healthy' : 'unhealthy',
                    timestamp: new Date().toISOString(),
                    services: {
                        neo4j: neo4jStatus ? 'healthy' : 'unhealthy',
                        postgres: postgresStatus ? 'healthy' : 'unhealthy',
                        queue: queueStatus ? 'healthy' : 'unhealthy'
                    }
                });
            }
            catch (error) {
                this.logger.error('Health check failed:', error);
                res.status(503).json({
                    status: 'unhealthy',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                });
            }
        });
        this.app.use('/graphql', (0, express4_1.expressMiddleware)(this.apolloServer, {
            context: async ({ req, res }) => {
                req.startTime = Date.now();
                return this.securityMiddleware.createContext({ req, res });
            }
        }));
        this.app.use((error, req, res, next) => {
            const requestId = req.id || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            this.logger.error('Express error:', {
                error: error.message,
                requestId,
                stack: error.stack
            });
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Internal server error',
                    requestId
                });
            }
        });
    }
    async createNeo4jIndexes() {
        this.logger.info('Creating Neo4j indexes and constraints...');
        try {
            const queries = [
                'CREATE CONSTRAINT org_id_unique IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE',
                'CREATE CONSTRAINT project_id_unique IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
                'CREATE INDEX project_org_id IF NOT EXISTS FOR (p:Project) ON (p.org_id)',
                'CREATE CONSTRAINT source_id_unique IF NOT EXISTS FOR (s:Source) REQUIRE s.id IS UNIQUE',
                'CREATE INDEX source_org_id IF NOT EXISTS FOR (s:Source) ON (s.org_id)',
                'CREATE CONSTRAINT file_id_unique IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE',
                'CREATE INDEX file_org_source IF NOT EXISTS FOR (f:File) ON (f.org_id, f.source_id)',
                'CREATE INDEX file_path IF NOT EXISTS FOR (f:File) ON (f.path)',
                'CREATE INDEX file_classification IF NOT EXISTS FOR (f:File) ON (f.classification_status)',
                'CREATE CONSTRAINT content_id_unique IF NOT EXISTS FOR (c:Content) REQUIRE c.id IS UNIQUE',
                'CREATE INDEX content_org_id IF NOT EXISTS FOR (c:Content) ON (c.org_id)',
                'CREATE INDEX content_type IF NOT EXISTS FOR (c:Content) ON (c.content_type)',
                'CREATE CONSTRAINT commit_id_unique IF NOT EXISTS FOR (c:Commit) REQUIRE c.id IS UNIQUE',
                'CREATE INDEX commit_org_branch IF NOT EXISTS FOR (c:Commit) ON (c.org_id, c.branch_name)',
                'CREATE CONSTRAINT version_id_unique IF NOT EXISTS FOR (v:Version) REQUIRE v.id IS UNIQUE',
                'CREATE INDEX version_entity IF NOT EXISTS FOR (v:Version) ON (v.entity_id, v.entity_type)',
                'CREATE FULLTEXT INDEX file_content_search IF NOT EXISTS FOR (f:File) ON EACH [f.name, f.path, f.extracted_text]',
                'CREATE FULLTEXT INDEX content_search IF NOT EXISTS FOR (c:Content) ON EACH [c.title, c.description]'
            ];
            for (const query of queries) {
                try {
                    await this.neo4jService.run(query);
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    if (!errorMessage.includes('already exists')) {
                        this.logger.warn(`Failed to create index/constraint: ${query}`, error);
                    }
                }
            }
            this.logger.info('Neo4j indexes and constraints created successfully');
        }
        catch (error) {
            this.logger.error('Failed to create Neo4j indexes:', error);
            throw error;
        }
    }
    async checkNeo4jHealth() {
        try {
            const result = await this.neo4jService.run('RETURN 1 as health');
            return result.records.length > 0;
        }
        catch {
            return false;
        }
    }
    async checkPostgresHealth() {
        try {
            const result = await this.postgresService.executeQuery('SELECT 1 as health');
            return result.rows.length > 0;
        }
        catch {
            return false;
        }
    }
    async checkQueueHealth() {
        try {
            await this.queueService.ping();
            return true;
        }
        catch {
            return false;
        }
    }
    getApp() {
        return this.app;
    }
    getHttpServer() {
        return this.httpServer;
    }
}
exports.GraphQLServer = GraphQLServer;
exports.graphqlServer = new GraphQLServer();
//# sourceMappingURL=server.js.map