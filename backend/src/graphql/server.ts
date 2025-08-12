import { ApolloServer, BaseContext } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import type { Context } from 'graphql-ws';
import { useServer } from 'graphql-ws/dist/use/ws';
import { PubSub } from 'graphql-subscriptions';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GraphQLError } from 'graphql';

import { EnhancedResolvers } from './resolvers/EnhancedResolvers';
import { SecurityMiddleware, GraphQLContext } from './middleware/SecurityMiddleware';
import { buildCoreResolvers } from './resolvers/core';
import { Neo4jService } from '../services/Neo4jService';
import { PostgresService } from '../services/PostgresService';
import { QueueService } from '../services/queues/QueueService';
import winston from 'winston';

export class GraphQLServer {
  private app: express.Application;
  private httpServer: any;
  private apolloServer?: ApolloServer<BaseContext>;
  private wsServer?: WebSocketServer;
  private enhancedResolvers: EnhancedResolvers;
  private securityMiddleware: SecurityMiddleware;
  private pubSub: PubSub;
  private logger: winston.Logger;
  private neo4jService: Neo4jService;
  private postgresService: PostgresService;

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  private queueService: QueueService;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.enhancedResolvers = new EnhancedResolvers();
    this.securityMiddleware = new SecurityMiddleware();
    this.pubSub = this.enhancedResolvers.getPubSub();
    this.neo4jService = new Neo4jService();
    this.postgresService = new PostgresService();
    this.queueService = new QueueService();
    
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.label({ label: 'graphql-server' })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/graphql-server.log',
          format: winston.format.json()
        })
      ]
    });
  }

  /**
   * Initialize and start the GraphQL server
   */
  async start(port: number = 4000): Promise<void> {
    try {
      // Initialize services
      await this.initializeServices();

      // Create GraphQL schema
      const schema = await this.createSchema();

      // Setup WebSocket server for subscriptions
      this.setupWebSocketServer(schema);

      // Create Apollo Server
      await this.createApolloServer(schema);

      // Setup Express middleware
      this.setupExpressMiddleware();

      // Start the server
      await new Promise<void>((resolve) => {
        this.httpServer.listen(port, () => {
          this.logger.info(`🚀 GraphQL Server ready at http://localhost:${port}/graphql`);
          this.logger.info(`🚀 GraphQL Subscriptions ready at ws://localhost:${port}/graphql`);
          resolve();
        });
      });

    } catch (error) {
      this.logger.error('Failed to start GraphQL server:', error);
      throw error;
    }
  }

  /**
   * Gracefully shutdown the server
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('Shutting down GraphQL server...');

      // Close WebSocket server
      if (this.wsServer) {
        this.wsServer.close();
      }

      // Stop Apollo Server
      if (this.apolloServer) {
        await this.apolloServer.stop();
      }

      // Close HTTP server
      await new Promise<void>((resolve) => {
        this.httpServer.close(() => resolve());
      });

      // Close database connections
      await this.neo4jService.close();
      await this.postgresService.close();
      await this.queueService.close();

      this.logger.info('GraphQL server stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping GraphQL server:', error);
      throw error;
    }
  }

  /**
   * Initialize all required services
   */
  private async initializeServices(): Promise<void> {
    this.logger.info('Initializing services...');
    
    try {
      // Initialize Neo4j connection
      await this.neo4jService.connect();
      this.logger.info('Neo4j connected');

      // Initialize PostgreSQL connection
      await this.postgresService.connect();
      this.logger.info('PostgreSQL connected');

      // Initialize Queue service
      await this.queueService.connect();
      this.logger.info('Queue service connected');

      // Create Neo4j indexes and constraints
      await this.createNeo4jIndexes();

    } catch (error) {
      this.logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Create GraphQL executable schema
   */
  private async createSchema() {
    this.logger.info('Creating GraphQL schema...');

    // Load schema files
    const enhancedTypeDefs = readFileSync(
      join(__dirname, 'schema', 'enhanced.graphql'),
      'utf8'
    );
    
    const coreTypeDefs = readFileSync(
      join(__dirname, 'schema', 'core.graphql'),
      'utf8'
    );

    // Combine type definitions
    const typeDefs = `
      ${enhancedTypeDefs}
      
      # Core types for backward compatibility
      ${coreTypeDefs}
    `;

    // Get resolvers
    const enhancedResolvers = this.enhancedResolvers.getResolvers();
    const coreResolvers = buildCoreResolvers();

    // Merge resolvers (enhanced takes precedence)
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

    return makeExecutableSchema({
      typeDefs,
      resolvers
    });
  }

  /**
   * Setup WebSocket server for GraphQL subscriptions
   */
  private async setupWebSocketServer(schema: any): Promise<void> {
    this.logger.info('Setting up WebSocket server...');

    this.wsServer = new WebSocketServer({
      server: this.httpServer,
      path: '/graphql'
    });

    // Dynamically import useServer to avoid module resolution issues
    const { useServer } = await import('graphql-ws/use/ws');

    useServer({
      schema,
      context: async (ctx: Context) => {
        // Create context for WebSocket connections
        try {
          return await this.securityMiddleware.createContext({
            req: (ctx.extra as any)?.request,
            res: (ctx.extra as any)?.response || {}
          } as any);
        } catch (error) {
          this.logger.error('WebSocket context creation failed:', error);
          throw error;
        }
      },
      onConnect: async (ctx: Context) => {
        this.logger.info('WebSocket client connected', {
          connectionParams: ctx.connectionParams
        });
      },
      onDisconnect: async (ctx: Context) => {
        this.logger.info('WebSocket client disconnected');
      },
      onError: (ctx: Context, id: string, payload: any, errors: readonly any[]) => {
        this.logger.error('WebSocket error:', { id, payload, errors });
      }
    }, this.wsServer);
  }

  /**
   * Create Apollo Server instance
   */
  private async createApolloServer(schema: any): Promise<void> {
    this.logger.info('Creating Apollo Server...');

    this.apolloServer = new ApolloServer<BaseContext>({
      schema,
      plugins: [
        // Plugin to handle HTTP server shutdown
        ApolloServerPluginDrainHttpServer({ httpServer: this.httpServer }),

        // Landing page for development
        process.env.NODE_ENV === 'production' 
          ? ApolloServerPluginLandingPageLocalDefault({ footer: false })
          : ApolloServerPluginLandingPageLocalDefault(),

        // Custom plugin for request logging
        {
          async requestDidStart() {
            return {
              async didResolveOperation(requestContext) {
                winston.debug('GraphQL operation resolved', {
                  operationName: requestContext.request.operationName,
                  query: requestContext.request.query
                });
              },
              async didEncounterErrors(requestContext) {
                winston.error('GraphQL errors encountered', {
                  operationName: requestContext.request.operationName,
                  errors: requestContext.errors
                });
              }
            };
          }
        },

        // Performance monitoring plugin
        {
          async requestDidStart() {
            const startTime = Date.now();
            return {
              async willSendResponse(requestContext) {
                const duration = Date.now() - startTime;
                winston.info('GraphQL request completed', {
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
        // Log all GraphQL errors
        // Type guard to safely access error properties
        if (error instanceof Error) {
          this.logger.error('GraphQL Error:', {
            message: error.message,
            locations: 'locations' in error ? (error as any).locations : undefined,
            path: 'path' in error ? (error as any).path : undefined,
            extensions: 'extensions' in error ? (error as any).extensions : undefined
          });
        } else {
          this.logger.error('GraphQL Error:', { error });
        }

        // Don't expose internal errors in production
        if (process.env.NODE_ENV === 'production') {
          // Type guard for extensions access
          if ('extensions' in error && error.extensions?.code === 'INTERNAL_SERVER_ERROR') {
            return new GraphQLError('Internal server error');
          }
        }

        return error;
      },
      introspection: process.env.NODE_ENV !== 'production',
      includeStacktraceInErrorResponses: process.env.NODE_ENV !== 'production'
    });

    await this.apolloServer.start();
  }

  /**
   * Setup Express middleware
   */
  private setupExpressMiddleware(): void {
    this.logger.info('Setting up Express middleware...');

    // CORS configuration
    this.app.use('/graphql', cors<cors.CorsRequest>({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Body parsing
    this.app.use('/graphql', express.json({ limit: '10mb' }));

    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        // Check service connectivity
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
      } catch (error) {
        this.logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });

    // GraphQL endpoint
    this.app.use('/graphql', expressMiddleware(this.apolloServer!, {
      context: async ({ req, res }: { req: express.Request; res: express.Response }) => {
        // Add request start time for performance monitoring
        (req as any).startTime = Date.now();
        
        return this.securityMiddleware.createContext({ req, res });
      }
    }));

    // Error handling middleware
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      // Generate or retrieve request ID
      const requestId = (req as any).id || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
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

  /**
   * Create Neo4j indexes and constraints for performance
   */
  private async createNeo4jIndexes(): Promise<void> {
    this.logger.info('Creating Neo4j indexes and constraints...');

    try {
      const queries = [
        // Organization constraints
        'CREATE CONSTRAINT org_id_unique IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE',
        
        // Project constraints and indexes
        'CREATE CONSTRAINT project_id_unique IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
        'CREATE INDEX project_org_id IF NOT EXISTS FOR (p:Project) ON (p.org_id)',
        
        // Source constraints and indexes
        'CREATE CONSTRAINT source_id_unique IF NOT EXISTS FOR (s:Source) REQUIRE s.id IS UNIQUE',
        'CREATE INDEX source_org_id IF NOT EXISTS FOR (s:Source) ON (s.org_id)',
        
        // File constraints and indexes
        'CREATE CONSTRAINT file_id_unique IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE',
        'CREATE INDEX file_org_source IF NOT EXISTS FOR (f:File) ON (f.org_id, f.source_id)',
        'CREATE INDEX file_path IF NOT EXISTS FOR (f:File) ON (f.path)',
        'CREATE INDEX file_classification IF NOT EXISTS FOR (f:File) ON (f.classification_status)',
        
        // Content constraints and indexes
        'CREATE CONSTRAINT content_id_unique IF NOT EXISTS FOR (c:Content) REQUIRE c.id IS UNIQUE',
        'CREATE INDEX content_org_id IF NOT EXISTS FOR (c:Content) ON (c.org_id)',
        'CREATE INDEX content_type IF NOT EXISTS FOR (c:Content) ON (c.content_type)',
        
        // Commit constraints and indexes
        'CREATE CONSTRAINT commit_id_unique IF NOT EXISTS FOR (c:Commit) REQUIRE c.id IS UNIQUE',
        'CREATE INDEX commit_org_branch IF NOT EXISTS FOR (c:Commit) ON (c.org_id, c.branch_name)',
        
        // Version constraints and indexes
        'CREATE CONSTRAINT version_id_unique IF NOT EXISTS FOR (v:Version) REQUIRE v.id IS UNIQUE',
        'CREATE INDEX version_entity IF NOT EXISTS FOR (v:Version) ON (v.entity_id, v.entity_type)',
        
        // Full-text search indexes
        'CREATE FULLTEXT INDEX file_content_search IF NOT EXISTS FOR (f:File) ON EACH [f.name, f.path, f.extracted_text]',
        'CREATE FULLTEXT INDEX content_search IF NOT EXISTS FOR (c:Content) ON EACH [c.title, c.description]'
      ];

      for (const query of queries) {
        try {
          await this.neo4jService.run(query);
        } catch (error) {
          // Ignore errors for already existing constraints/indexes
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes('already exists')) {
            this.logger.warn(`Failed to create index/constraint: ${query}`, error);
          }
        }
      }

      this.logger.info('Neo4j indexes and constraints created successfully');
    } catch (error) {
      this.logger.error('Failed to create Neo4j indexes:', error);
      throw error;
    }
  }

  /**
   * Health check methods
   */
  private async checkNeo4jHealth(): Promise<boolean> {
    try {
      const result = await this.neo4jService.run('RETURN 1 as health');
      return result.records.length > 0;
    } catch {
      return false;
    }
  }

  private async checkPostgresHealth(): Promise<boolean> {
    try {
      const result = await this.postgresService.executeQuery('SELECT 1 as health');
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }

  private async checkQueueHealth(): Promise<boolean> {
    try {
      await this.queueService.ping();
      return true;
    } catch {
      return false;
    }
  }

  // Public methods to access app and httpServer
  public getApp(): express.Application {
    return this.app;
  }

  public getHttpServer(): any {
    return this.httpServer;
  }
}

// Export singleton instance
export const graphqlServer = new GraphQLServer();
