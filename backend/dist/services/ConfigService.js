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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = void 0;
const dotenv_1 = require("dotenv");
const fs = __importStar(require("fs"));
(0, dotenv_1.config)();
class ConfigService {
    constructor() {
        this.databaseConfig = this.loadDatabaseConfig();
        this.authConfig = this.loadAuthConfig();
        this.appConfig = this.loadAppConfig();
    }
    loadDatabaseConfig() {
        return {
            neo4j: {
                uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
                user: process.env.NEO4J_USER || 'neo4j',
                password: process.env.NEO4J_PASSWORD || 'password',
                encrypted: process.env.NEO4J_ENCRYPTED === 'true',
                maxConnectionPoolSize: parseInt(process.env.NEO4J_MAX_CONNECTION_POOL_SIZE || '10'),
                connectionTimeout: parseInt(process.env.NEO4J_CONNECTION_TIMEOUT || '30000')
            },
            postgres: {
                host: process.env.POSTGRES_HOST || 'localhost',
                port: parseInt(process.env.POSTGRES_PORT || '5432'),
                database: process.env.POSTGRES_DB || 'olivine',
                user: process.env.POSTGRES_USER || 'postgres',
                password: process.env.POSTGRES_PASSWORD || 'password',
                maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20'),
                idleTimeout: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
                connectionTimeout: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '2000')
            },
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined,
                db: parseInt(process.env.REDIS_DB || '0')
            }
        };
    }
    loadAuthConfig() {
        return {
            jwtSecret: process.env.JWT_SECRET || 'default_secret',
            jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
            jwtIssuer: process.env.JWT_ISSUER || 'olivine',
            bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10')
        };
    }
    loadAppConfig() {
        return {
            environment: process.env.NODE_ENV || 'development',
            port: parseInt(process.env.PORT || '3000'),
            logLevel: process.env.LOG_LEVEL || 'info'
        };
    }
    getDatabaseConfig() {
        return this.databaseConfig;
    }
    getNeo4jConfig() {
        return this.databaseConfig.neo4j;
    }
    getPostgresConfig() {
        return this.databaseConfig.postgres;
    }
    getRedisConfig() {
        return this.databaseConfig.redis;
    }
    getAuthConfig() {
        return this.authConfig;
    }
    getJwtConfig() {
        return {
            secret: this.authConfig.jwtSecret,
            expiresIn: this.authConfig.jwtExpiresIn,
            issuer: this.authConfig.jwtIssuer
        };
    }
    getAppConfig() {
        return this.appConfig;
    }
    validateConfig() {
        if (!this.databaseConfig.neo4j.uri || !this.databaseConfig.neo4j.user || !this.databaseConfig.neo4j.password) {
            console.error('Invalid Neo4j configuration');
            return false;
        }
        if (!this.databaseConfig.postgres.host || !this.databaseConfig.postgres.database ||
            !this.databaseConfig.postgres.user || !this.databaseConfig.postgres.password) {
            console.error('Invalid PostgreSQL configuration');
            return false;
        }
        if (!this.databaseConfig.redis.host) {
            console.error('Invalid Redis configuration');
            return false;
        }
        if (this.authConfig.jwtSecret === 'default_secret') {
            console.warn('Using default JWT secret - not recommended for production');
        }
        return true;
    }
    loadSecretFromFile(secretPath) {
        try {
            if (fs.existsSync(secretPath)) {
                return fs.readFileSync(secretPath, 'utf8').trim();
            }
            return null;
        }
        catch (error) {
            console.error(`Error loading secret from file ${secretPath}:`, error);
            return null;
        }
    }
    healthCheck() {
        try {
            return this.validateConfig();
        }
        catch (error) {
            console.error('Config service health check failed:', error);
            return false;
        }
    }
}
exports.ConfigService = ConfigService;
//# sourceMappingURL=ConfigService.js.map