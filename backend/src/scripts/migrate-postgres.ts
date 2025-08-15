import fs from 'fs';
import path from 'path';
import { PostgresService } from '../services/PostgresService';

async function runPostgresMigrations() {
  const postgresService = new PostgresService();
  const migrationsDir = path.join(__dirname, '../migrations/postgres');

  try {
    if (!fs.existsSync(migrationsDir)) {
      console.log('No PostgreSQL migrations directory found');
      process.exit(0);
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file);
      const migrationContent = fs.readFileSync(migrationPath, 'utf8');

      const statements = migrationContent
        .split(';')
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0);

      console.log(`Applying PostgreSQL migration: ${file} with ${statements.length} statements`);

      for (const statement of statements) {
        if (statement.trim().length > 0) {
          try {
            await postgresService.executeQuery(statement);
          } catch (error: unknown) {
            const message = (typeof error === 'object' && error !== null && 'message' in error)
              ? String((error as any).message).toLowerCase()
              : '';
            const code = (typeof error === 'object' && error !== null && 'code' in error)
              ? String((error as any).code)
              : '';

            const isDuplicate =
              message.includes('already exists') ||
              message.includes('duplicate') ||
              code === '42710' || // duplicate_object
              code === '42P07';   // duplicate_table

            if (isDuplicate) {
              console.log('Object already exists, skipping');
            } else {
              throw error;
            }
          }
        }
      }
    }

    console.log('PostgreSQL migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error running PostgreSQL migrations:', error);
    process.exit(1);
  }
}

runPostgresMigrations();


