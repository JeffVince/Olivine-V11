"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const apollo_server_express_1 = require("apollo-server-express");
const graphql_1 = require("@neo4j/graphql");
const neo4j_driver_1 = __importDefault(require("neo4j-driver"));
const dotenv_1 = require("dotenv");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
(0, dotenv_1.config)();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
const driver = neo4j_driver_1.default.driver(process.env.NEO4J_URI || 'bolt://localhost:7687', neo4j_driver_1.default.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password'));
const typeDefs = `type Query {
  hello: String
}`;
const neoSchema = new graphql_1.Neo4jGraphQL({
    typeDefs,
    driver,
});
const server = new apollo_server_express_1.ApolloServer({
    context: ({ req }) => ({ req }),
});
async function startServer() {
    try {
        const schema = await neoSchema.getSchema();
        const apolloServer = new apollo_server_express_1.ApolloServer({ schema });
        await apolloServer.start();
        apolloServer.applyMiddleware({ app: app, path: '/graphql' });
        const port = process.env.PORT || 8080;
        app.listen(port, () => {
            console.log(`Olivine backend server running on port ${port}`);
            console.log(`GraphQL endpoint available at http://localhost:${port}/graphql`);
        });
    }
    catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
}
startServer();
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await server.stop();
    await driver.close();
    process.exit(0);
});
//# sourceMappingURL=index.js.map