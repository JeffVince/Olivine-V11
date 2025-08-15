import { PostgresService } from '../services/PostgresService';

async function checkTableStructure() {
  const postgresService = new PostgresService();
  
  try {
    // Check if organizations table exists
    const orgTable = await postgresService.executeQuery(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'organizations'"
    );
    console.log('Organizations table exists:', orgTable.rows.length > 0);
    
    // Check sources table structure
    const sourcesColumns = await postgresService.executeQuery(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sources' ORDER BY ordinal_position"
    );
    console.log('Sources table columns:', sourcesColumns.rows);
    
    // Check files table structure
    const filesColumns = await postgresService.executeQuery(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'files' ORDER BY ordinal_position"
    );
    console.log('Files table columns:', filesColumns.rows);
    
    // Check users table structure
    const usersColumns = await postgresService.executeQuery(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position"
    );
    console.log('Users table columns:', usersColumns.rows);
    
    // Check if organizations table exists and its structure
    if (orgTable.rows.length > 0) {
      const orgColumns = await postgresService.executeQuery(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'organizations' ORDER BY ordinal_position"
      );
      console.log('Organizations table columns:', orgColumns.rows);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking table structure:', error);
    process.exit(1);
  }
}

checkTableStructure();
