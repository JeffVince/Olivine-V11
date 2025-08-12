"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNeo4jConfig = getNeo4jConfig;
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
function getNeo4jConfig() {
    return {
        uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
        user: process.env.NEO4J_USER || 'neo4j',
        password: process.env.NEO4J_PASSWORD || 'password',
        maxConnectionPoolSize: parseInt(process.env.NEO4J_MAX_CONNECTION_POOL_SIZE || '10'),
        connectionTimeout: parseInt(process.env.NEO4J_CONNECTION_TIMEOUT || '30000'),
        encrypted: process.env.NEO4J_ENCRYPTED === 'true'
    };
}
//# sourceMappingURL=neo4j.js.map