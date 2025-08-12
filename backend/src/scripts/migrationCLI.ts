#!/usr/bin/env node

import { MigrationService } from '../services/MigrationService';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function main() {
  const migrationService = new MigrationService();
  
  // Create migration directories if they don't exist
  await migrationService.createMigrationDirectories();
  
  const argv = yargs(hideBin(process.argv))
    .command('migrate', 'Run pending migrations', {}, async () => {
      try {
        console.log('Running migrations...');
        await migrationService.applyAllMigrations();
        console.log('Migrations completed successfully!');
      } catch (error) {
        console.error('Error running migrations:', error);
        process.exit(1);
      } finally {
        await migrationService.close();
      }
    })
    .command('status', 'Show migration status', {}, async () => {
      try {
        console.log('Checking migration status...');
        const isHealthy = await migrationService.healthCheck();
        console.log(`Migration service health: ${isHealthy ? 'Healthy' : 'Unhealthy'}`);
      } catch (error) {
        console.error('Error checking migration status:', error);
        process.exit(1);
      } finally {
        await migrationService.close();
      }
    })
    .command('rollback', 'Rollback last migration', {}, async () => {
      try {
        console.log('Rollback functionality not yet implemented');
        console.log('This would rollback the last applied migration');
      } catch (error) {
        console.error('Error rolling back migration:', error);
        process.exit(1);
      } finally {
        await migrationService.close();
      }
    })
    .demandCommand(1, 'You need at least one command before moving on')
    .help()
    .argv;
}

main();
