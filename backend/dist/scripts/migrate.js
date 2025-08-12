"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MigrationService_1 = require("../services/MigrationService");
async function runMigrations() {
    const migrationService = new MigrationService_1.MigrationService();
    try {
        await migrationService.createMigrationDirectories();
        await migrationService.applyAllMigrations();
        console.log('Migrations completed successfully!');
        process.exit(0);
    }
    catch (error) {
        console.error('Error running migrations:', error);
        process.exit(1);
    }
}
runMigrations();
//# sourceMappingURL=migrate.js.map