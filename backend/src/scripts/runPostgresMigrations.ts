import { MigrationService } from '../services/MigrationService';
import { PostgresService } from '../services/PostgresService';
import fs from 'fs';
import path from 'path';

async function runPostgresMigrations() {
  const postgresService = new PostgresService();
  const migrationsDir = path.join(__dirname, '../migrations/postgres');
  
  if (!fs.existsSync(migrationsDir)) {
    console.log('No PostgreSQL migrations directory found');
    process.exit(0);
  }
  
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  console.log('Applying PostgreSQL migrations...');
  
  for (const file of migrationFiles) {
    const migrationPath = path.join(migrationsDir, file);
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    
    // Split migration content into separate statements
    const statements = migrationContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`Applying PostgreSQL migration: ${file} with ${statements.length} statements`);
    
    // Execute each statement separately
    for (const statement of statements) {
      if (statement.trim().length > 0) {
        try {
          await postgresService.executeQuery(statement);
        } catch (error: unknown) {
          // Skip errors that indicate duplicate policy creation regardless of ordering
          const message = (typeof error === 'object' && error !== null && 'message' in error)
            ? String((error as any).message).toLowerCase()
            : '';
          const code = (typeof error === 'object' && error !== null && 'code' in error)
            ? String((error as any).code)
            : '';

          const isDuplicatePolicy =
            message.includes('policy already exists') ||
            message.includes('already exists') ||
            message.includes('duplicate') ||
            code === '42710';

          if (isDuplicatePolicy) {
            console.log('Policy already exists, skipping');
          } else {
            console.error('Error executing PostgreSQL query:', error);
            throw error;
          }
        }
      }
    }
  }
  
  console.log('PostgreSQL migrations completed successfully!');
  process.exit(0);
}

runPostgresMigrations();
