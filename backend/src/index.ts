import express, { Request, Response } from 'express';
import { ApolloServer } from 'apollo-server-express';
import { Neo4jGraphQL } from '@neo4j/graphql';
import fs from 'fs'
import path from 'path'
import { buildAgentResolvers } from './graphql/resolvers/agent'
import { buildCoreResolvers } from './graphql/resolvers/core'
import { makeExecutableSchema } from '@graphql-tools/schema'
import neo4j from 'neo4j-driver';
import { config } from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { DropboxWebhookHandler } from './handlers/DropboxWebhookHandler';
import { GoogleDriveWebhookHandler } from './handlers/GoogleDriveWebhookHandler';
import { QueueService } from './services/queues/QueueService';
import { QueueMonitor } from './services/queues/QueueMonitor';
import { AgentRegistry } from './agents/registry/AgentRegistry';
import { FileStewardAgent } from './agents/FileStewardAgent';
import { TaxonomyClassificationAgent } from './agents/TaxonomyClassificationAgent';
import { ProvenanceTrackingAgent } from './agents/ProvenanceTrackingAgent';
import { SyncAgent } from './agents/SyncAgent';
import oauthRoutes from './routes/oauthRoutes';

// Load environment variables
// TODO: Implementation Plan - 09-Monitoring-Logging-Implementation.md - Environment variable loading and configuration
config();

const app = express();

// Apply middleware
// TODO: Implementation Plan - 05-API-Implementation.md - API middleware configuration
// TODO: Implementation Checklist - 05-API-GraphQL-Checklist.md - Security middleware implementation
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use('/api/oauth', oauthRoutes);

// Initialize webhook handlers (will be created after queueService is instantiated)

// Dropbox webhook routes
// TODO: Implementation Plan - 05-API-Implementation.md - Dropbox webhook route configuration
// TODO: Implementation Checklist - 05-API-GraphQL-Checklist.md - API route security and validation
app.get('/api/webhooks/dropbox', (req: Request, res: Response) => dropboxWebhookHandler.handleWebhook(req, res));
app.post('/api/webhooks/dropbox', (req: Request, res: Response) => dropboxWebhookHandler.handleWebhook(req, res));

// Google Drive webhook routes
// TODO: Implementation Plan - 05-API-Implementation.md - Google Drive webhook route configuration
app.post('/api/webhooks/gdrive', (req: Request, res: Response) => gdriveWebhookHandler.handleWebhook(req, res));

// Neo4j driver setup
// TODO: Implementation Plan - 03-Knowledge-Graph-Implementation.md - Neo4j database connection setup
// TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Database connection error handling
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
);

// Load GraphQL typeDefs
const coreTypeDefs = fs.readFileSync(path.join(__dirname, 'graphql/schema/core.graphql'), 'utf8')
const agentTypeDefs = fs.readFileSync(path.join(__dirname, 'graphql/schema/agent.graphql'), 'utf8')

// Create Neo4jGraphQL instance (for possible future use with graph-native types)
const neoSchema = new Neo4jGraphQL({ typeDefs: 'type Placeholder { id: ID }', driver });

// Instantiate infrastructure services
// TODO: Implementation Plan - 06-Agent-System-Implementation.md - Queue service initialization
// TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend infrastructure service tests
const queueService = new QueueService({
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  prefix: process.env.QUEUE_PREFIX || 'olivine',
})
new QueueMonitor(queueService).start()

// Initialize webhook handlers
const dropboxWebhookHandler = new DropboxWebhookHandler(queueService);
const gdriveWebhookHandler = new GoogleDriveWebhookHandler(queueService);

const registry = new AgentRegistry()
registry.register({ name: 'file-steward-agent', instance: new FileStewardAgent(queueService) })
registry.register({ name: 'taxonomy-classification-agent', instance: new TaxonomyClassificationAgent(queueService) })
registry.register({ name: 'provenance-tracking-agent', instance: new ProvenanceTrackingAgent(queueService) })
registry.register({ name: 'sync-agent', instance: new SyncAgent(queueService) })

// Start server function
async function startServer() {
  try {
    // Get the generated schema
    const neo4jSchema = await neoSchema.getSchema();
    const agentResolvers = buildAgentResolvers(queueService)
    const coreResolvers = buildCoreResolvers()
    const schema = makeExecutableSchema({
      typeDefs: [neo4jSchema, coreTypeDefs as any, agentTypeDefs as any] as any,
      resolvers: [coreResolvers as any, agentResolvers as any] as any,
    })
    const apolloServer = new ApolloServer({ schema });
    await apolloServer.start();
    // Apply Apollo GraphQL middleware
    apolloServer.applyMiddleware({ app: app as any, path: '/graphql' });
    
    // Start the Express server
    const port = process.env.PORT || 8080;
    app.listen(port, async () => {
      await registry.startAll();
      console.log(`Olivine backend server running on port ${port}`);
      console.log(`GraphQL endpoint available at http://localhost:${port}/graphql`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await registry.stopAll();
  await driver.close();
  await queueService.close();
  process.exit(0);
});
