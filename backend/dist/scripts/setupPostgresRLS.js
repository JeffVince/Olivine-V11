"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PostgresService_1 = require("../services/PostgresService");
async function setupPostgresRLS() {
    const postgresService = new PostgresService_1.PostgresService();
    try {
        console.log('Setting up Row Level Security (RLS) for PostgreSQL tables...');
        await postgresService.executeQuery(`
      ALTER TABLE organizations ENABLE ROW LEVEL SECURITY
    `);
        await postgresService.executeQuery(`
      ALTER TABLE users ENABLE ROW LEVEL SECURITY
    `);
        await postgresService.executeQuery(`
      ALTER TABLE sources ENABLE ROW LEVEL SECURITY
    `);
        await postgresService.executeQuery(`
      ALTER TABLE files ENABLE ROW LEVEL SECURITY
    `);
        await postgresService.executeQuery(`
      CREATE POLICY org_isolation_policy ON organizations 
      FOR ALL TO PUBLIC 
      USING (id = current_setting('app.organization_id')::UUID)
    `);
        await postgresService.executeQuery(`
      CREATE POLICY user_org_isolation_policy ON users 
      FOR ALL TO PUBLIC 
      USING (organization_id = current_setting('app.organization_id')::UUID)
    `);
        await postgresService.executeQuery(`
      CREATE POLICY source_org_isolation_policy ON sources 
      FOR ALL TO PUBLIC 
      USING (organization_id = current_setting('app.organization_id')::UUID)
    `);
        await postgresService.executeQuery(`
      CREATE POLICY file_org_isolation_policy ON files 
      FOR ALL TO PUBLIC 
      USING (organization_id = current_setting('app.organization_id')::UUID)
    `);
        console.log('PostgreSQL RLS setup completed successfully!');
    }
    catch (error) {
        console.error('Error setting up PostgreSQL RLS:', error);
    }
    finally {
        await postgresService.close();
    }
}
setupPostgresRLS();
//# sourceMappingURL=setupPostgresRLS.js.map