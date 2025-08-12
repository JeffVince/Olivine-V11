import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { Neo4jGraphQL } from '@neo4j/graphql';
import neo4j from 'neo4j-driver';
import { config } from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';

// Load environment variables
config();

const app = express();

// Apply middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Neo4j driver setup
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
);

// Placeholder for GraphQL schema
const typeDefs = `type Query {
  hello: String
}`;

// Create Neo4jGraphQL instance
const neoSchema = new Neo4jGraphQL({
  typeDefs,
  driver,
});

// Create Apollo Server
const server = new ApolloServer({
  context: ({ req }) => ({ req }),
});

// Start server function
async function startServer() {
  try {
    // Get the generated schema
    const schema = await neoSchema.getSchema();
    // Start the Apollo Server with the generated schema
    const apolloServer = new ApolloServer({ schema });
    await apolloServer.start();
    // Apply Apollo GraphQL middleware
    apolloServer.applyMiddleware({ app: app as any, path: '/graphql' });
    
    // Start the Express server
    const port = process.env.PORT || 8080;
    app.listen(port, () => {
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
  await server.stop();
  await driver.close();
  process.exit(0);
});
