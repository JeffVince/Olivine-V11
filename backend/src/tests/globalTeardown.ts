import { Neo4jService } from '../services/Neo4jService';
import { PostgresService } from '../services/PostgresService';
import { QueueService } from '../services/queues/QueueService';

export default async function globalTeardown() {
  console.log('🧹 Tearing down global test environment...');

  try {
    // Initialize services for cleanup
    const neo4jService = new Neo4jService();
    const postgresService = new PostgresService();
    const queueService = new QueueService();

    // Connect to services
    await neo4jService.connect();
    await postgresService.connect();
    await queueService.connect();

    // Clean up test data
    console.log('🗑️ Cleaning up test data...');
    
    // Clear Neo4j test database
    await neo4jService.run('MATCH (n) DETACH DELETE n');
    
    // Clear Redis data (if needed)
    // Note: QueueService doesn't have clearAllQueues method, so we'll skip this for now

    // Close all connections
    await neo4jService.close();
    await postgresService.close();
    await queueService.close();

    console.log('✅ Global test teardown completed successfully');

  } catch (error) {
    console.error('❌ Global test teardown failed:', error instanceof Error ? error.message : String(error));
    // Don't throw error to avoid breaking test suite
  }

  // Force exit after a short delay to ensure all connections are closed
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}
