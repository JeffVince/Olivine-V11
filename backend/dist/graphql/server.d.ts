export declare class GraphQLServer {
    private app;
    private httpServer;
    private apolloServer?;
    private wsServer?;
    private enhancedResolvers;
    private securityMiddleware;
    private pubSub;
    private logger;
    private neo4jService;
    private postgresService;
    private queueService;
    constructor();
    start(port?: number): Promise<void>;
    stop(): Promise<void>;
    private initializeServices;
    private createSchema;
    private setupWebSocketServer;
    private createApolloServer;
    private setupExpressMiddleware;
    private createNeo4jIndexes;
    private checkNeo4jHealth;
    private checkPostgresHealth;
    private checkQueueHealth;
}
export declare const graphqlServer: GraphQLServer;
//# sourceMappingURL=server.d.ts.map