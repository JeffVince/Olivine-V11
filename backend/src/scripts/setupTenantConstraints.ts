import { Neo4jService } from '../services/Neo4jService';

async function setupTenantConstraints() {
  const neo4jService = new Neo4jService();
  
  try {
    console.log('Setting up tenant constraints for all node types...');
    
    // Note: Property existence constraints require Neo4j Enterprise Edition
    // For Community Edition, we'll rely on application-level validation
    // but we can still create unique constraints and indexes
    
    // Add org_id indexes to File nodes
    await neo4jService.executeQuery(`
      CREATE INDEX file_org_id_index IF NOT EXISTS 
      FOR (f:File) 
      ON (f.org_id)
    `);
    
    // Add org_id indexes to Content nodes
    await neo4jService.executeQuery(`
      CREATE INDEX content_org_id_index IF NOT EXISTS 
      FOR (c:Content) 
      ON (c.org_id)
    `);
    
    // Add org_id indexes to Commit nodes
    await neo4jService.executeQuery(`
      CREATE INDEX commit_org_id_index IF NOT EXISTS 
      FOR (c:Commit) 
      ON (c.org_id)
    `);
    
    // Add org_id indexes to Version nodes
    await neo4jService.executeQuery(`
      CREATE INDEX version_org_id_index IF NOT EXISTS 
      FOR (v:Version) 
      ON (v.org_id)
    `);
    
    // Add org_id indexes to User nodes
    await neo4jService.executeQuery(`
      CREATE INDEX user_org_id_index IF NOT EXISTS 
      FOR (u:User) 
      ON (u.org_id)
    `);
    
    // Add org_id indexes to Category nodes
    await neo4jService.executeQuery(`
      CREATE INDEX category_org_id_index IF NOT EXISTS 
      FOR (c:Category) 
      ON (c.org_id)
    `);
    
    // Add org_id indexes to Tag nodes
    await neo4jService.executeQuery(`
      CREATE INDEX tag_org_id_index IF NOT EXISTS 
      FOR (t:Tag) 
      ON (t.org_id)
    `);
    
    console.log('Tenant indexes setup completed successfully!');
    console.log('Note: Property existence constraints require Neo4j Enterprise Edition');
    console.log('Application-level validation will be used instead');
  } catch (error) {
    console.error('Error setting up tenant constraints:', error);
  } finally {
    await neo4jService.close();
  }
}

// Run the setup function
setupTenantConstraints();
