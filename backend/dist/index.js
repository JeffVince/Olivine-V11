"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const graphql_1 = require("@neo4j/graphql");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const neo4j_driver_1 = __importDefault(require("neo4j-driver"));
const dotenv_1 = require("dotenv");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const DropboxWebhookHandler_1 = require("./handlers/DropboxWebhookHandler");
const GoogleDriveWebhookHandler_1 = require("./handlers/GoogleDriveWebhookHandler");
const QueueService_1 = require("./services/queues/QueueService");
const QueueMonitor_1 = require("./services/queues/QueueMonitor");
const AgentRegistry_1 = require("./agents/registry/AgentRegistry");
const FileStewardAgent_1 = require("./agents/FileStewardAgent");
const TaxonomyClassificationAgent_1 = require("./agents/TaxonomyClassificationAgent");
const ProvenanceTrackingAgent_1 = require("./agents/ProvenanceTrackingAgent");
const SyncAgent_1 = require("./agents/SyncAgent");
const oauthRoutes_1 = __importDefault(require("./routes/oauthRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const server_1 = require("./graphql/server");
(0, dotenv_1.config)();
const app = (0, express_1.default)();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
app.use((0, cors_1.default)({
    origin: FRONTEND_ORIGIN,
    credentials: true,
}));
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
app.use('/api/oauth', oauthRoutes_1.default);
app.use('/api/auth', authRoutes_1.default);
app.get('/api/webhooks/dropbox', (req, res) => dropboxWebhookHandler.handleWebhook(req, res));
app.post('/api/webhooks/dropbox', (req, res) => dropboxWebhookHandler.handleWebhook(req, res));
app.post('/api/webhooks/gdrive', (req, res) => gdriveWebhookHandler.handleWebhook(req, res));
const driver = neo4j_driver_1.default.driver(process.env.NEO4J_URI || 'bolt://localhost:7687', neo4j_driver_1.default.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password'));
const coreTypeDefs = fs_1.default.readFileSync(path_1.default.join(__dirname, 'graphql/schema/core.graphql'), 'utf8');
const agentTypeDefs = fs_1.default.readFileSync(path_1.default.join(__dirname, 'graphql/schema/agent.graphql'), 'utf8');
const neoSchema = new graphql_1.Neo4jGraphQL({ typeDefs: 'type Placeholder { id: ID }', driver });
const queueService = new QueueService_1.QueueService({
    redisUrl: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}/0`,
    prefix: process.env.QUEUE_PREFIX || 'olivine',
});
new QueueMonitor_1.QueueMonitor(queueService).start();
const dropboxWebhookHandler = new DropboxWebhookHandler_1.DropboxWebhookHandler(queueService);
const gdriveWebhookHandler = new GoogleDriveWebhookHandler_1.GoogleDriveWebhookHandler(queueService);
const registry = new AgentRegistry_1.AgentRegistry();
registry.register({ name: 'file-steward-agent', instance: new FileStewardAgent_1.FileStewardAgent(queueService) });
registry.register({ name: 'taxonomy-classification-agent', instance: new TaxonomyClassificationAgent_1.TaxonomyClassificationAgent(queueService) });
registry.register({ name: 'provenance-tracking-agent', instance: new ProvenanceTrackingAgent_1.ProvenanceTrackingAgent(queueService) });
registry.register({ name: 'sync-agent', instance: new SyncAgent_1.SyncAgent(queueService) });
async function startServer() {
    try {
        const graphqlServer = new server_1.GraphQLServer();
        const port = parseInt(process.env.PORT || '8080', 10);
        await graphqlServer.start(port);
        const app = graphqlServer.getApp();
        app.use((0, cors_1.default)({
            origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
            credentials: true,
        }));
        app.use((0, helmet_1.default)());
        app.use(express_1.default.json());
        app.use('/api/oauth', oauthRoutes_1.default);
        app.use('/api/auth', authRoutes_1.default);
        const dropboxWebhookHandler = new DropboxWebhookHandler_1.DropboxWebhookHandler(queueService);
        const gdriveWebhookHandler = new GoogleDriveWebhookHandler_1.GoogleDriveWebhookHandler(queueService);
        app.get('/api/webhooks/dropbox', (req, res) => dropboxWebhookHandler.handleWebhook(req, res));
        app.post('/api/webhooks/dropbox', (req, res) => dropboxWebhookHandler.handleWebhook(req, res));
        app.get('/api/webhooks/gdrive', (req, res) => gdriveWebhookHandler.handleWebhook(req, res));
        app.post('/api/webhooks/gdrive', (req, res) => gdriveWebhookHandler.handleWebhook(req, res));
        await registry.startAll();
        console.log(`Olivine backend server running on port ${port}`);
        console.log(`GraphQL endpoint available at http://localhost:${port}/graphql`);
    }
    catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
}
startServer();
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await registry.stopAll();
    await driver.close();
    await queueService.close();
    process.exit(0);
});
//# sourceMappingURL=index.js.map