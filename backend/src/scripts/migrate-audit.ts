import fs from 'fs';
import path from 'path';
import { PostgresService } from '../services/PostgresService';

async function runAuditMigration() {
  const postgresService = new PostgresService();
  const migrationsDir = path.join(__dirname, '../migrations/postgres');

  try {
    const file = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.includes('audit_log') && f.endsWith('.sql'))
      .sort()
      .pop();

    if (!file) {
      console.log('No audit_log migration found');
      process.exit(0);
    }

    const migrationPath = path.join(migrationsDir, file);
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');

    const statements = migrationContent
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Applying audit_log migration: ${file} with ${statements.length} statements`);

    for (const statement of statements) {
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

    console.log('audit_log migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error running audit_log migration:', error);
    process.exit(1);
  }
}

runAuditMigration();


