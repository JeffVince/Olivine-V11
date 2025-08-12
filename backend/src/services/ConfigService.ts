import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

interface DatabaseConfig {
  neo4j: {
    uri: string;
    user: string;
    password: string;
    encrypted: boolean;
    maxConnectionPoolSize: number;
    connectionTimeout: number;
  };
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    maxConnections: number;
    idleTimeout: number;
    connectionTimeout: number;
  };
  redis: {
    host: string;
    port: number;
    password: string | undefined;
    db: number;
  };
}

interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtIssuer: string;
  bcryptSaltRounds: number;
}

interface AppConfig {
  environment: string;
  port: number;
  logLevel: string;
}

export class ConfigService {
  // TODO: Implementation Plan - 01-Foundation-Setup.md - Configuration service implementation
  // TODO: Implementation Checklist - 01-Foundation-Setup-Checklist.md - Environment variable configuration
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend configuration service tests
  private databaseConfig: DatabaseConfig;
  private authConfig: AuthConfig;
  private appConfig: AppConfig;

  constructor() {
    this.databaseConfig = this.loadDatabaseConfig();
    this.authConfig = this.loadAuthConfig();
    this.appConfig = this.loadAppConfig();
  }

  /**
   * Load database configuration from environment variables
   */
  private loadDatabaseConfig(): DatabaseConfig {
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

  /**
   * Load authentication configuration from environment variables
   */
  private loadAuthConfig(): AuthConfig {
    return {
      jwtSecret: process.env.JWT_SECRET || 'default_secret',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
      jwtIssuer: process.env.JWT_ISSUER || 'olivine',
      bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10')
    };
  }

  /**
   * Load application configuration from environment variables
   */
  private loadAppConfig(): AppConfig {
    return {
      environment: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT || '3000'),
      logLevel: process.env.LOG_LEVEL || 'info'
    };
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig(): DatabaseConfig {
    return this.databaseConfig;
  }

  /**
   * Get Neo4j configuration
   */
  getNeo4jConfig(): DatabaseConfig['neo4j'] {
    return this.databaseConfig.neo4j;
  }

  /**
   * Get PostgreSQL configuration
   */
  getPostgresConfig(): DatabaseConfig['postgres'] {
    return this.databaseConfig.postgres;
  }

  /**
   * Get Redis configuration
   */
  getRedisConfig(): DatabaseConfig['redis'] {
    return this.databaseConfig.redis;
  }

  /**
   * Get authentication configuration
   */
  getAuthConfig(): AuthConfig {
    return this.authConfig;
  }

  /**
   * Get JWT configuration
   */
  getJwtConfig(): { secret: string; expiresIn: string; issuer: string } {
    return {
      secret: this.authConfig.jwtSecret,
      expiresIn: this.authConfig.jwtExpiresIn,
      issuer: this.authConfig.jwtIssuer
    };
  }

  /**
   * Get application configuration
   */
  getAppConfig(): AppConfig {
    return this.appConfig;
  }

  /**
   * Validate configuration
   */
  validateConfig(): boolean {
    // Validate Neo4j configuration
    if (!this.databaseConfig.neo4j.uri || !this.databaseConfig.neo4j.user || !this.databaseConfig.neo4j.password) {
      console.error('Invalid Neo4j configuration');
      return false;
    }

    // Validate PostgreSQL configuration
    if (!this.databaseConfig.postgres.host || !this.databaseConfig.postgres.database || 
        !this.databaseConfig.postgres.user || !this.databaseConfig.postgres.password) {
      console.error('Invalid PostgreSQL configuration');
      return false;
    }

    // Validate Redis configuration
    if (!this.databaseConfig.redis.host) {
      console.error('Invalid Redis configuration');
      return false;
    }

    // Validate JWT secret
    if (this.authConfig.jwtSecret === 'default_secret') {
      console.warn('Using default JWT secret - not recommended for production');
    }

    return true;
  }

  /**
   * Load secrets from files (for production)
   * @param secretPath Path to secret file
   */
  loadSecretFromFile(secretPath: string): string | null {
    try {
      if (fs.existsSync(secretPath)) {
        return fs.readFileSync(secretPath, 'utf8').trim();
      }
      return null;
    } catch (error) {
      console.error(`Error loading secret from file ${secretPath}:`, error);
      return null;
    }
  }

  /**
   * Health check for configuration service
   */
  healthCheck(): boolean {
    try {
      return this.validateConfig();
    } catch (error) {
      console.error('Config service health check failed:', error);
      return false;
    }
  }
}
