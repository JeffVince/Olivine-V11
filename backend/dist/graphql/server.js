"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphqlServer = exports.GraphQLServer = void 0;
const server_1 = require("@apollo/server");
const schema_1 = require("@graphql-tools/schema");
const ws_1 = require("ws");
const ws_2 = require("graphql-ws/lib/use/ws");
const http_1 = require("http");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = require("fs");
const path_1 = require("path");
const graphql_1 = require("graphql");
const EnhancedResolvers_1 = require("./resolvers/EnhancedResolvers");
const SecurityMiddleware_1 = require("./middleware/SecurityMiddleware");
const core_1 = require("./resolvers/core");
const Neo4jService_1 = require("../services/Neo4jService");
const PostgresService_1 = require("../services/PostgresService");
const QueueService_1 = require("../services/queues/QueueService");
const winston_1 = __importDefault(require("winston"));
class GraphQLServer {
    constructor() {
        this.app = (0, express_1.default)();
        this.httpServer = (0, http_1.createServer)(this.app);
        this.enhancedResolvers = new EnhancedResolvers_1.EnhancedResolvers();
        this.securityMiddleware = new SecurityMiddleware_1.SecurityMiddleware();
        this.pubSub = this.enhancedResolvers.getPubSub();
        this.neo4jService = new Neo4jService_1.Neo4jService();
        this.postgresService = new PostgresService_1.PostgresService();
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
        const enhancedTypeDefs = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'schema', 'enhanced.graphql'), 'utf8');
        const coreTypeDefs = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'schema', 'core.graphql'), 'utf8');
        const typeDefs = `
      ${enhancedTypeDefs}
      
      # Core types for backward compatibility
      ${coreTypeDefs}
    `;
        const enhancedResolvers = this.enhancedResolvers.getResolvers();
        const coreResolvers = (0, core_1.buildCoreResolvers)();
        const resolvers = {
            ...coreResolvers,
            ...enhancedResolvers,
            Query: {
                ...coreResolvers.Query,
                ...enhancedResolvers.Query
            },
            Mutation: {
                ...coreResolvers.Mutation,
                ...enhancedResolvers.Mutation
            }
        };
        return (0, schema_1.makeExecutableSchema)({
            typeDefs,
            resolvers
        });
    }
    setupWebSocketServer(schema) {
        this.logger.info('Setting up WebSocket server...');
        this.wsServer = new ws_1.WebSocketServer({
            server: this.httpServer,
            path: '/graphql'
        });
        (0, ws_2.useServer)({
            schema,
            context: async (ctx) => {
                try {
                    return await this.securityMiddleware.createContext({
                        req: ctx.extra.request,
                        res: ctx.extra.response || {}
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
            onError: (ctx, message, errors) => {
                this.logger.error('WebSocket error:', { message, errors });
            }
        }, this.wsServer);
    }
    async createApolloServer(schema) {
        this.logger.info('Creating Apollo Server...');
        this.apolloServer = new server_1.ApolloServer({
            schema,
            plugins: [
                ApolloServerPluginDrainHttpServer({ httpServer: this.httpServer }),
                process.env.NODE_ENV === 'production'
                    ? ApolloServerPluginLandingPageLocalDefault({ footer: false })
                    : ApolloServerPluginLandingPageLocalDefault(),
                {
                    async requestDidStart() {
                        return {
                            async didResolveOperation(requestContext) {
                                winston_1.default.debug('GraphQL operation resolved', {
                                    operationName: requestContext.request.operationName,
                                    query: requestContext.request.query
                                });
                            },
                            async didEncounterErrors(requestContext) {
                                winston_1.default.error('GraphQL errors encountered', {
                                    operationName: requestContext.request.operationName,
                                    errors: requestContext.errors
                                });
                            }
                        };
                    }
                },
                {
                    async requestDidStart() {
                        return {
                            async willSendResponse(requestContext) {
                                const duration = Date.now() - requestContext.request.http?.startTime || 0;
                                winston_1.default.info('GraphQL request completed', {
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
                this.logger.error('GraphQL Error:', {
                    message: error.message,
                    locations: error.locations,
                    path: error.path,
                    extensions: error.extensions
                });
                if (process.env.NODE_ENV === 'production') {
                    if (error.extensions?.code === 'INTERNAL_SERVER_ERROR') {
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
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        this.app.use('/graphql', expressMiddleware(this.apolloServer, {
            context: async ({ req, res }) => {
                req.startTime = Date.now();
                return this.securityMiddleware.createContext({ req, res });
            }
        }));
        this.app.use((error, req, res, next) => {
            this.logger.error('Express error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Internal server error',
                    requestId: req.id
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
                    if (!error.message.includes('already exists')) {
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
}
exports.GraphQLServer = GraphQLServer;
exports.graphqlServer = new GraphQLServer();
//# sourceMappingURL=server.js.map