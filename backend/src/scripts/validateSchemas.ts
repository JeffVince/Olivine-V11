#!/usr/bin/env node

import { Neo4jService } from '../services/Neo4jService';
import { PostgresService } from '../services/PostgresService';

async function validateNeo4jSchema() {
  const neo4jService = new Neo4jService();
  
  try {
    console.log('Validating Neo4j schema...');
    
    // Check constraints
    const constraintsResult = await neo4jService.executeQuery('SHOW CONSTRAINTS');
    console.log('Neo4j Constraints:');
    constraintsResult.records.forEach((record: any) => {
      console.log(`  - ${record.get('name')}: ${record.get('type')}`);
    });
    
    // Check indexes
    const indexesResult = await neo4jService.executeQuery('SHOW INDEXES');
    console.log('Neo4j Indexes:');
    indexesResult.records.forEach((record: any) => {
      console.log(`  - ${record.get('name')}: ${record.get('type')}`);
    });
    
    // Verify core ontology nodes exist
    const nodeTypes = ['File', 'Content', 'Provenance', 'Ops'];
    for (const nodeType of nodeTypes) {
      const countResult = await neo4jService.executeQuery(
        `MATCH (n:${nodeType}) RETURN count(n) as count`
      );
      console.log(`  - ${nodeType} nodes: ${countResult.records[0].get('count')}`);
    }
    
    console.log('Neo4j schema validation completed successfully!');
    return true;
  } catch (error) {
    console.error('Error validating Neo4j schema:', error);
    return false;
  } finally {
    await neo4jService.close();
  }
}

async function validatePostgreSQLSchema() {
  const postgresService = new PostgresService();
  
  try {
    console.log('Validating PostgreSQL schema...');
    
    // Check tables
    const tablesResult = await postgresService.executeQuery(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);
    
    console.log('PostgreSQL Tables and Columns:');
    let currentTable = '';
    tablesResult.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log(`  Table: ${currentTable}`);
      }
      console.log(`    - ${row.column_name} (${row.data_type}, ${row.is_nullable === 'YES' ? 'nullable' : 'not nullable'})`);
    });
    
    // Check RLS status
    const rlsResult = await postgresService.executeQuery(`
      SELECT tablename, relrowsecurity as rls_enabled
      FROM pg_tables t
      JOIN pg_class c ON t.tablename = c.relname
      WHERE schemaname = 'public'
    `);
    
    console.log('PostgreSQL RLS Status:');
    rlsResult.rows.forEach(row => {
      console.log(`  - ${row.tablename}: ${row.rls_enabled ? 'Enabled' : 'Disabled'}`);
    });
    
    console.log('PostgreSQL schema validation completed successfully!');
    return true;
  } catch (error) {
    console.error('Error validating PostgreSQL schema:', error);
    return false;
  } finally {
    await postgresService.close();
  }
}

async function validateServiceIntegration() {
  try {
    console.log('Validating service integration...');
    
    // Test that all services can be instantiated without errors
    const neo4jService = new Neo4jService();
    const postgresService = new PostgresService();
    
    // Test health checks
    const neo4jHealthy = await neo4jService.healthCheck();
    const postgresHealthy = await postgresService.healthCheck();
    
    console.log(`Neo4j service health: ${neo4jHealthy ? 'Healthy' : 'Unhealthy'}`);
    console.log(`PostgreSQL service health: ${postgresHealthy ? 'Healthy' : 'Unhealthy'}`);
    
    await neo4jService.close();
    await postgresService.close();
    
    return neo4jHealthy && postgresHealthy;
  } catch (error) {
    console.error('Error validating service integration:', error);
    return false;
  }
}

async function main() {
  console.log('Starting schema validation...');
  
  const neo4jValid = await validateNeo4jSchema();
  const postgresValid = await validatePostgreSQLSchema();
  const integrationValid = await validateServiceIntegration();
  
  if (neo4jValid && postgresValid && integrationValid) {
    console.log('\n✅ All schema validations passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some schema validations failed!');
    process.exit(1);
  }
}

main();
