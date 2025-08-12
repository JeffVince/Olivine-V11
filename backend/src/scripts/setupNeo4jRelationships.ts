import { Neo4jService } from '../services/Neo4jService';

async function setupNeo4jRelationships() {
  const neo4jService = new Neo4jService();
  
  try {
    // Relationship Definitions
    console.log('Setting up Neo4j Relationships...');
    
    // BELONGS_TO relationship between File and Content nodes
    await neo4jService.executeQuery(`
      CREATE INDEX belongs_to_index IF NOT EXISTS 
      FOR ()-[r:BELONGS_TO]-() 
      ON (r.org_id)
    `);
    
    // VERSION relationship between Commit and Version nodes
    await neo4jService.executeQuery(`
      CREATE INDEX version_index IF NOT EXISTS 
      FOR ()-[r:VERSION]-() 
      ON (r.timestamp)
    `);
    
    // AUTHORED relationship between User and Commit nodes
    await neo4jService.executeQuery(`
      CREATE INDEX authored_index IF NOT EXISTS 
      FOR ()-[r:AUTHORED]-() 
      ON (r.timestamp)
    `);
    
    // LINKED relationship between Content nodes
    await neo4jService.executeQuery(`
      CREATE INDEX linked_index IF NOT EXISTS 
      FOR ()-[r:LINKED]-() 
      ON (r.type)
    `);
    
    // TAGGED relationship between Content and Tag nodes
    await neo4jService.executeQuery(`
      CREATE INDEX tagged_index IF NOT EXISTS 
      FOR ()-[r:TAGGED]-() 
      ON (r.confidence)
    `);
    
    console.log('Neo4j relationships setup completed successfully!');
  } catch (error) {
    console.error('Error setting up Neo4j relationships:', error);
  } finally {
    await neo4jService.close();
  }
}

// Run the setup function
setupNeo4jRelationships();
