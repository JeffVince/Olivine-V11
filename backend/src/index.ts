import express, { Request, Response } from 'express';
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
import authRoutes from './routes/authRoutes';
import { GraphQLServer } from './graphql/server';

// Load environment variables
// TODO: Implementation Plan - 09-Monitoring-Logging-Implementation.md - Environment variable loading and configuration
config();

const app = express();

// Apply middleware
// TODO: Implementation Plan - 05-API-Implementation.md - API middleware configuration
// TODO: Implementation Checklist - 05-API-GraphQL-Checklist.md - Security middleware implementation
// CORS: Allow frontend origin and credentials for Apollo client with credentials: 'include'
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000'
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
}));
app.use(helmet());
app.use(express.json());
app.use('/api/oauth', oauthRoutes);
app.use('/api/auth', authRoutes);

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
  redisUrl: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}/0`,
  prefix: process.env.QUEUE_PREFIX || 'olivine',
})
new QueueMonitor(queueService).start()

// Initialize webhook handlers
const dropboxWebhookHandler = new DropboxWebhookHandler(queueService);
const gdriveWebhookHandler = new GoogleDriveWebhookHandler(queueService);

// Store reference to GraphQL server instance
let graphqlServerInstance: GraphQLServer;

// Start server function
async function startServer() {
  try {
    if (starting) return;
    starting = true;
    // Create GraphQL server with WebSocket support
    graphqlServerInstance = new GraphQLServer();
    
    // Start the GraphQL server
    const port = parseInt(process.env.PORT || '8080', 10);
    await graphqlServerInstance.start(port);
    
    // Get the Express app from the GraphQL server
    const app = graphqlServerInstance.getApp();
    
    // Apply additional middleware
    app.use(cors({
      origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
      credentials: true,
    }));
    app.use(helmet());
    app.use(express.json());
    app.use('/api/oauth', oauthRoutes);
    app.use('/api/auth', authRoutes);
    
    // Initialize webhook handlers (will be created after queueService is instantiated)
    const dropboxWebhookHandler = new DropboxWebhookHandler(queueService);
    const gdriveWebhookHandler = new GoogleDriveWebhookHandler(queueService);
    
    // Dropbox webhook routes
    app.get('/api/webhooks/dropbox', (req: Request, res: Response) => dropboxWebhookHandler.handleWebhook(req, res));
    app.post('/api/webhooks/dropbox', (req: Request, res: Response) => dropboxWebhookHandler.handleWebhook(req, res));
    
    // Google Drive webhook routes
    app.get('/api/webhooks/gdrive', (req: Request, res: Response) => gdriveWebhookHandler.handleWebhook(req, res));
    app.post('/api/webhooks/gdrive', (req: Request, res: Response) => gdriveWebhookHandler.handleWebhook(req, res));
    
    await registry.startAll();
    console.log(`Olivine backend server running on port ${port}`);
    console.log(`GraphQL endpoint available at http://localhost:${port}/graphql`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  } finally {
    starting = false;
  }
}

// Prevent duplicate starts when nodemon restarts rapidly
let starting = false;
startServer();

// Graceful shutdown function
async function gracefulShutdown(signal: string) {
  console.log(`${signal} received. Shutting down gracefully...`);
  
  try {
    if (starting) {
      console.log('Startup in progress. Waiting briefly before shutdown...');
      await new Promise((r) => setTimeout(r, 250));
    }
    // Stop all agents
    await registry.stopAll();
    console.log('All agents stopped');
    
    // Stop GraphQL server if it exists
    if (graphqlServerInstance) {
      await graphqlServerInstance.stop();
      console.log('GraphQL server stopped');
    }
    
    // Close database connections
    await driver.close();
    console.log('Neo4j connection closed');
    
    // Close queue service
    await queueService.close();
    console.log('Queue service closed');
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Handle different shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

const registry = new AgentRegistry()
registry.register({ name: 'file-steward-agent', instance: new FileStewardAgent(queueService) })
registry.register({ name: 'taxonomy-classification-agent', instance: new TaxonomyClassificationAgent(queueService) })
registry.register({ name: 'provenance-tracking-agent', instance: new ProvenanceTrackingAgent(queueService) })
registry.register({ name: 'sync-agent', instance: new SyncAgent(queueService) })
