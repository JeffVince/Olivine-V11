import { Neo4jService } from '../services/Neo4jService';

async function setupNeo4jSchema() {
  const neo4jService = new Neo4jService();
  
  try {
    // File Ontology Constraints and Indexes
    console.log('Setting up File Ontology...');
    
    await neo4jService.executeQuery(`
      CREATE CONSTRAINT file_id_unique IF NOT EXISTS 
      FOR (f:File) 
      REQUIRE f.id IS UNIQUE
    `);
    
    await neo4jService.executeQuery(`
      CREATE CONSTRAINT file_org_path IF NOT EXISTS 
      FOR (f:File) 
      REQUIRE (f.org_id, f.path) IS UNIQUE
    `);
    
    await neo4jService.executeQuery(`
      CREATE INDEX file_org_id IF NOT EXISTS 
      FOR (f:File) 
      ON (f.org_id)
    `);
    
    await neo4jService.executeQuery(`
      CREATE INDEX file_modified IF NOT EXISTS 
      FOR (f:File) 
      ON (f.modified)
    `);
    
    await neo4jService.executeQuery(`
      CREATE INDEX file_type IF NOT EXISTS 
      FOR (f:File) 
      ON (f.type)
    `);
    
    // Content Ontology Constraints and Indexes
    console.log('Setting up Content Ontology...');
    
    await neo4jService.executeQuery(`
      CREATE CONSTRAINT content_id_unique IF NOT EXISTS 
      FOR (c:Content) 
      REQUIRE c.id IS UNIQUE
    `);
    
    await neo4jService.executeQuery(`
      CREATE INDEX content_org_id IF NOT EXISTS 
      FOR (c:Content) 
      ON (c.org_id)
    `);
    
    await neo4jService.executeQuery(`
      CREATE INDEX content_classification IF NOT EXISTS 
      FOR (c:Content) 
      ON (c.classification)
    `);
    
    await neo4jService.executeQuery(`
      CREATE INDEX content_confidence IF NOT EXISTS 
      FOR (c:Content) 
      ON (c.confidence)
    `);
    
    // Provenance Ontology Constraints
    console.log('Setting up Provenance Ontology...');
    
    await neo4jService.executeQuery(`
      CREATE CONSTRAINT commit_id_unique IF NOT EXISTS 
      FOR (c:Commit) 
      REQUIRE c.id IS UNIQUE
    `);
    
    await neo4jService.executeQuery(`
      CREATE CONSTRAINT version_id_unique IF NOT EXISTS 
      FOR (v:Version) 
      REQUIRE v.id IS UNIQUE
    `);
    
    await neo4jService.executeQuery(`
      CREATE INDEX commit_timestamp IF NOT EXISTS 
      FOR (c:Commit) 
      ON (c.timestamp)
    `);
    
    await neo4jService.executeQuery(`
      CREATE INDEX commit_author IF NOT EXISTS 
      FOR (c:Commit) 
      ON (c.author)
    `);
    
    console.log('Neo4j schema setup completed successfully!');
  } catch (error) {
    console.error('Error setting up Neo4j schema:', error);
  } finally {
    await neo4jService.close();
  }
}

// Run the setup function
setupNeo4jSchema();
