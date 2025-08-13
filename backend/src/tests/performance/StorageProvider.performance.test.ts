import { StorageProviderFactory, MultiProviderSyncOrchestrator } from '../../services/StorageProvider';

// Performance tests for storage providers
// These tests measure the performance of various operations

describe('StorageProvider Performance', () => {
  // Note: These tests are for measuring performance and should be run separately
  // They are commented out by default as they may be slow
  
  describe('Factory Pattern Performance', () => {
    it('should create providers quickly', async () => {
      const startTime = performance.now();
      
      // Create 1000 providers to test performance
      for (let i = 0; i < 1000; i++) {
        await StorageProviderFactory.createProvider('dropbox');
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should create 1000 providers in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });
  
  describe('Orchestrator Performance', () => {
    it('should handle multiple providers efficiently', async () => {
      const orchestrator = new MultiProviderSyncOrchestrator();
      
      const startTime = performance.now();
      
      // Test with 100 providers
      const sourceIds = Array.from({ length: 100 }, (_, i) => `source-${i}`);
      await orchestrator.syncProviders('test-org', sourceIds);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should handle 100 providers in under 500ms
      expect(duration).toBeLessThan(500);
    });
  });
});
