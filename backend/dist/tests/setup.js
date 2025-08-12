"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
try {
    require('dotenv').config();
}
catch (e) {
}
process.env.NODE_ENV = 'test';
jest.setTimeout(30000);
global.testUtils = {
    generateTestId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    waitForCondition: async (condition, timeout = 5000, interval = 100) => {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (await condition()) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        throw new Error(`Condition not met within ${timeout}ms`);
    },
    cleanupDatabase: async (services, orgId) => {
        if (services.neo4j) {
            await services.neo4j.run('MATCH (n {org_id: $orgId}) DETACH DELETE n', { orgId });
        }
        if (services.postgres) {
            const tables = [
                'taxonomy_rules', 'taxonomy_profiles', 'files', 'sources',
                'organizations', 'projects', 'users'
            ];
            for (const table of tables) {
                await services.postgres.executeQuery(`DELETE FROM ${table} WHERE org_id = $1`, [orgId]);
            }
        }
    }
};
jest.mock('../services/DropboxService', () => {
    return {
        DropboxService: jest.fn().mockImplementation(() => ({
            connect: jest.fn().mockResolvedValue(true),
            disconnect: jest.fn().mockResolvedValue(true),
            listFiles: jest.fn().mockResolvedValue([]),
            getFileMetadata: jest.fn().mockResolvedValue({}),
            downloadFile: jest.fn().mockResolvedValue(Buffer.from('test'))
        }))
    };
});
jest.mock('../services/GoogleDriveService', () => {
    return {
        GoogleDriveService: jest.fn().mockImplementation(() => ({
            connect: jest.fn().mockResolvedValue(true),
            disconnect: jest.fn().mockResolvedValue(true),
            listFiles: jest.fn().mockResolvedValue([]),
            getFileMetadata: jest.fn().mockResolvedValue({}),
            downloadFile: jest.fn().mockResolvedValue(Buffer.from('test'))
        }))
    };
});
if (!process.env.ENABLE_TEST_LOGS) {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
}
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});
//# sourceMappingURL=setup.js.map