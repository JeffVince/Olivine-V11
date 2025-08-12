"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StorageProvider_1 = require("../../services/StorageProvider");
describe('StorageProvider Performance', () => {
    describe('Factory Pattern Performance', () => {
        it('should create providers quickly', () => {
            const startTime = performance.now();
            for (let i = 0; i < 1000; i++) {
                StorageProvider_1.StorageProviderFactory.createProvider('dropbox');
            }
            const endTime = performance.now();
            const duration = endTime - startTime;
            expect(duration).toBeLessThan(100);
        });
    });
    describe('Orchestrator Performance', () => {
        it('should handle multiple providers efficiently', async () => {
            const orchestrator = new StorageProvider_1.MultiProviderSyncOrchestrator();
            const startTime = performance.now();
            const sourceIds = Array.from({ length: 100 }, (_, i) => `source-${i}`);
            await orchestrator.syncProviders('test-org', sourceIds);
            const endTime = performance.now();
            const duration = endTime - startTime;
            expect(duration).toBeLessThan(500);
        });
    });
});
//# sourceMappingURL=StorageProvider.performance.test.js.map