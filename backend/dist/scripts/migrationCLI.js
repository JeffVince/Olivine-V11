#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const MigrationService_1 = require("../services/MigrationService");
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
async function main() {
    const migrationService = new MigrationService_1.MigrationService();
    await migrationService.createMigrationDirectories();
    const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .command('migrate', 'Run pending migrations', {}, async () => {
        try {
            console.log('Running migrations...');
            await migrationService.applyAllMigrations();
            console.log('Migrations completed successfully!');
        }
        catch (error) {
            console.error('Error running migrations:', error);
            process.exit(1);
        }
        finally {
            await migrationService.close();
        }
    })
        .command('status', 'Show migration status', {}, async () => {
        try {
            console.log('Checking migration status...');
            const isHealthy = await migrationService.healthCheck();
            console.log(`Migration service health: ${isHealthy ? 'Healthy' : 'Unhealthy'}`);
        }
        catch (error) {
            console.error('Error checking migration status:', error);
            process.exit(1);
        }
        finally {
            await migrationService.close();
        }
    })
        .command('rollback', 'Rollback last migration', {}, async () => {
        try {
            console.log('Rollback functionality not yet implemented');
            console.log('This would rollback the last applied migration');
        }
        catch (error) {
            console.error('Error rolling back migration:', error);
            process.exit(1);
        }
        finally {
            await migrationService.close();
        }
    })
        .demandCommand(1, 'You need at least one command before moving on')
        .help()
        .argv;
}
main();
//# sourceMappingURL=migrationCLI.js.map