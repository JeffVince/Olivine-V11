import { PostgresService } from '../services/PostgresService';

async function setupPostgresRLS() {
  const postgresService = new PostgresService();
  
  try {
    console.log('Setting up Row Level Security (RLS) for PostgreSQL tables...');
    
    // Enable RLS on organizations table
    await postgresService.executeQuery(`
      ALTER TABLE organizations ENABLE ROW LEVEL SECURITY
    `);
    
    // Enable RLS on users table
    await postgresService.executeQuery(`
      ALTER TABLE users ENABLE ROW LEVEL SECURITY
    `);
    
    // Enable RLS on sources table
    await postgresService.executeQuery(`
      ALTER TABLE sources ENABLE ROW LEVEL SECURITY
    `);
    
    // Enable RLS on files table
    await postgresService.executeQuery(`
      ALTER TABLE files ENABLE ROW LEVEL SECURITY
    `);
    
    // Create RLS policies for organizations table
    await postgresService.executeQuery(`
      CREATE POLICY org_isolation_policy ON organizations 
      FOR ALL TO PUBLIC 
      USING (id = current_setting('app.organization_id')::UUID)
    `);
    
    // Create RLS policies for users table
    await postgresService.executeQuery(`
      CREATE POLICY user_org_isolation_policy ON users 
      FOR ALL TO PUBLIC 
      USING (organization_id = current_setting('app.organization_id')::UUID)
    `);
    
    // Create RLS policies for sources table
    await postgresService.executeQuery(`
      CREATE POLICY source_org_isolation_policy ON sources 
      FOR ALL TO PUBLIC 
      USING (organization_id = current_setting('app.organization_id')::UUID)
    `);
    
    // Create RLS policies for files table
    await postgresService.executeQuery(`
      CREATE POLICY file_org_isolation_policy ON files 
      FOR ALL TO PUBLIC 
      USING (organization_id = current_setting('app.organization_id')::UUID)
    `);
    
    console.log('PostgreSQL RLS setup completed successfully!');
  } catch (error) {
    console.error('Error setting up PostgreSQL RLS:', error);
  } finally {
    await postgresService.close();
  }
}

// Run the setup function
setupPostgresRLS();
