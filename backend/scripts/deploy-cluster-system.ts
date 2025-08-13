#!/usr/bin/env ts-node

/**
 * Cluster-Centric System Deployment Script
 * 
 * This script deploys the complete cluster-centric knowledge representation system
 * including database migrations, service initialization, and agent orchestration.
 */

import { Neo4jService } from '../src/services/Neo4jService';
import { PostgresService } from '../src/services/PostgresService';
import { QueueService } from '../src/services/queues/QueueService';
import { AgentRegistry } from '../src/services/AgentRegistry';
import { readFileSync } from 'fs';
import { join } from 'path';

interface DeploymentConfig {
  enableClusterMode: boolean;
  runMigrations: boolean;
  validateSystem: boolean;
  startAgents: boolean;
}

class ClusterSystemDeployment {
  private neo4jService: Neo4jService;
  private postgresService: PostgresService;
  private queueService: QueueService;
  private agentRegistry: AgentRegistry;

  constructor() {
    this.neo4jService = new Neo4jService();
    this.postgresService = new PostgresService();
    this.queueService = new QueueService();
    this.agentRegistry = AgentRegistry.getInstance();
  }

  async deploy(config: DeploymentConfig): Promise<void> {
    console.log('🚀 Starting Cluster-Centric System Deployment...');

    try {
      // Step 1: Run database migrations
      if (config.runMigrations) {
        await this.runMigrations();
      }

      // Step 2: Initialize services
      await this.initializeServices();

      // Step 3: Configure cluster mode
      if (config.enableClusterMode) {
        await this.enableClusterMode();
      }

      // Step 4: Validate system integrity
      if (config.validateSystem) {
        await this.validateSystem();
      }

      // Step 5: Start agent orchestration
      if (config.startAgents) {
        await this.startAgentSystem();
      }

      console.log('✅ Cluster-Centric System Deployment Complete!');
      
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      throw error;
    }
  }

  private async runMigrations(): Promise<void> {
    console.log('📊 Running database migrations...');

    // Run PostgreSQL migrations
    const sqlMigration = readFileSync(
      join(__dirname, '../migrations/001_cluster_staging_tables.sql'),
      'utf-8'
    );
    
    await this.postgresService.query(sqlMigration);
    console.log('  ✓ PostgreSQL staging tables created');

    // Run Neo4j constraints and indexes
    const cypherMigration = readFileSync(
      join(__dirname, '../migrations/001_cluster_neo4j_constraints.cypher'),
      'utf-8'
    );
    
    const cypherStatements = cypherMigration
      .split(';')
      .filter(stmt => stmt.trim().length > 0);
    
    for (const statement of cypherStatements) {
      await this.neo4jService.run(statement.trim());
    }
    console.log('  ✓ Neo4j constraints and indexes created');
  }

  private async initializeServices(): Promise<void> {
    console.log('🔧 Initializing core services...');

    // Initialize queue service
    await this.queueService.initialize();
    console.log('  ✓ Queue service initialized');

    // Set up agent registry with required services
    this.agentRegistry.setQueueService(this.queueService);
    this.agentRegistry.setServices(this.neo4jService, this.postgresService);
    console.log('  ✓ Agent registry configured');
  }

  private async enableClusterMode(): Promise<void> {
    console.log('🔄 Enabling cluster-centric mode...');

    // Enable cluster mode in agent registry
    this.agentRegistry.enableClusterMode();
    
    // Initialize cluster-aware agents
    await this.agentRegistry.initializeAgents();
    console.log('  ✓ Cluster-centric agents initialized');
  }

  private async validateSystem(): Promise<void> {
    console.log('🔍 Validating system integrity...');

    // Validate Neo4j connectivity and constraints
    const neo4jHealth = await this.neo4jService.run('RETURN 1 as health');
    if (!neo4jHealth.records.length) {
      throw new Error('Neo4j connectivity check failed');
    }
    console.log('  ✓ Neo4j connectivity verified');

    // Validate PostgreSQL connectivity and tables
    const pgHealth = await this.postgresService.query('SELECT 1 as health');
    if (!pgHealth.rows.length) {
      throw new Error('PostgreSQL connectivity check failed');
    }
    console.log('  ✓ PostgreSQL connectivity verified');

    // Validate staging tables exist
    const stagingTables = await this.postgresService.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('content_cluster', 'extraction_job', 'parser_registry', 'promotion_audit')
    `);
    
    if (stagingTables.rows.length < 4) {
      throw new Error('Required staging tables not found');
    }
    console.log('  ✓ Staging tables verified');

    // Validate Neo4j constraints
    const constraints = await this.neo4jService.run('SHOW CONSTRAINTS');
    const constraintCount = constraints.records.length;
    console.log(`  ✓ ${constraintCount} Neo4j constraints active`);
  }

  private async startAgentSystem(): Promise<void> {
    console.log('🤖 Starting agent orchestration system...');

    // Start all registered agents
    await this.agentRegistry.startAllAgents();
    console.log('  ✓ All agents started successfully');

    // Verify agent health
    const registeredAgents = this.agentRegistry.getRegisteredAgents();
    console.log(`  ✓ ${registeredAgents.length} agents active`);
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down cluster system...');

    try {
      await this.agentRegistry.stopAllAgents();
      await this.queueService.shutdown();
      await this.neo4jService.close();
      await this.postgresService.close();
      console.log('✅ Cluster system shutdown complete');
    } catch (error) {
      console.error('❌ Shutdown error:', error);
    }
  }
}

// CLI interface
async function main() {
  const deployment = new ClusterSystemDeployment();
  
  const config: DeploymentConfig = {
    enableClusterMode: process.env.CLUSTER_MODE !== 'false',
    runMigrations: process.env.RUN_MIGRATIONS !== 'false',
    validateSystem: process.env.VALIDATE_SYSTEM !== 'false',
    startAgents: process.env.START_AGENTS !== 'false'
  };

  console.log('Configuration:', config);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await deployment.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await deployment.shutdown();
    process.exit(0);
  });

  try {
    await deployment.deploy(config);
    
    // Keep the process running if agents are started
    if (config.startAgents) {
      console.log('🔄 Cluster system running. Press Ctrl+C to stop.');
      // Keep process alive
      setInterval(() => {
        // Health check or maintenance tasks could go here
      }, 30000);
    }
    
  } catch (error) {
    console.error('💥 Deployment failed:', error);
    await deployment.shutdown();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { ClusterSystemDeployment, DeploymentConfig };
