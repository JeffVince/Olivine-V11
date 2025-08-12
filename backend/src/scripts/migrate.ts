import { MigrationService } from '../services/MigrationService';

async function runMigrations() {
  const migrationService = new MigrationService();
  
  try {
    await migrationService.createMigrationDirectories();
    await migrationService.applyAllMigrations();
    console.log('Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

runMigrations();
