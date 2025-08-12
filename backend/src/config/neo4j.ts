import { config } from 'dotenv';

// Load environment variables
config();

export interface Neo4jConfig {
  // TODO: Implementation Plan - 03-Knowledge-Graph-Implementation.md - Neo4j configuration interface
  // TODO: Implementation Checklist - 01-Foundation-Setup-Checklist.md - Neo4j configuration validation
  uri: string;
  user: string;
  password: string;
  maxConnectionPoolSize: number;
  connectionTimeout: number;
  encrypted: boolean;
}

/**
 * Get Neo4j configuration from environment variables
 * @returns Neo4jConfig object with connection settings
 */
export function getNeo4jConfig(): Neo4jConfig {
  return {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
    maxConnectionPoolSize: parseInt(process.env.NEO4J_MAX_CONNECTION_POOL_SIZE || '10'),
    connectionTimeout: parseInt(process.env.NEO4J_CONNECTION_TIMEOUT || '30000'),
    encrypted: process.env.NEO4J_ENCRYPTED === 'true'
  };
}
