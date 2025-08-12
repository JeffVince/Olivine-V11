"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Neo4jService_1 = require("../services/Neo4jService");
async function setupNeo4jRelationships() {
    const neo4jService = new Neo4jService_1.Neo4jService();
    try {
        console.log('Setting up Neo4j Relationships...');
        await neo4jService.executeQuery(`
      CREATE INDEX belongs_to_index IF NOT EXISTS 
      FOR ()-[r:BELONGS_TO]-() 
      ON (r.org_id)
    `);
        await neo4jService.executeQuery(`
      CREATE INDEX version_index IF NOT EXISTS 
      FOR ()-[r:VERSION]-() 
      ON (r.timestamp)
    `);
        await neo4jService.executeQuery(`
      CREATE INDEX authored_index IF NOT EXISTS 
      FOR ()-[r:AUTHORED]-() 
      ON (r.timestamp)
    `);
        await neo4jService.executeQuery(`
      CREATE INDEX linked_index IF NOT EXISTS 
      FOR ()-[r:LINKED]-() 
      ON (r.type)
    `);
        await neo4jService.executeQuery(`
      CREATE INDEX tagged_index IF NOT EXISTS 
      FOR ()-[r:TAGGED]-() 
      ON (r.confidence)
    `);
        console.log('Neo4j relationships setup completed successfully!');
    }
    catch (error) {
        console.error('Error setting up Neo4j relationships:', error);
    }
    finally {
        await neo4jService.close();
    }
}
setupNeo4jRelationships();
//# sourceMappingURL=setupNeo4jRelationships.js.map