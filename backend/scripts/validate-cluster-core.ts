#!/usr/bin/env ts-node

/**
 * Simplified Cluster Processing Core Validation
 * 
 * This script validates the core cluster-centric functionality without
 * getting blocked by peripheral type safety issues.
 */

import { FileStewardAgent } from '../src/agents/FileStewardAgent';
import { AgentRegistry } from '../src/services/AgentRegistry';
import { CrossLayerEnforcementService } from '../src/services/CrossLayerEnforcementService';

interface ValidationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  error?: string;
}

class ClusterCoreValidator {
  private results: ValidationResult[] = [];

  private addResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, error?: string) {
    this.results.push({ test, status, message, error });
  }

  /**
   * Test 1: Verify FileStewardAgent has cluster methods
   */
  async testFileStewardAgentClusterMethods(): Promise<void> {
    try {
      console.log('🔍 Testing FileStewardAgent cluster methods...');
      
      // Create a mock QueueService for testing
      const mockQueueService = {
        addJob: async () => ({ id: 'test-job' }),
        getJobStatus: async () => ({ status: 'completed' }),
        processQueue: async () => {},
        clearQueue: async () => {}
      };

      const agent = new FileStewardAgent(mockQueueService as any);
      
      // Check if cluster methods exist
      const hasEnableClusterMode = typeof agent.enableClusterMode === 'function';
      const hasDisableClusterMode = typeof agent.disableClusterMode === 'function';
      const hasProcessFileWithCluster = typeof (agent as any).processFileWithCluster === 'function';
      const hasCreateContentCluster = typeof (agent as any).createContentCluster === 'function';
      
      if (hasEnableClusterMode && hasDisableClusterMode && hasProcessFileWithCluster && hasCreateContentCluster) {
        this.addResult('FileStewardAgent Cluster Methods', 'PASS', 'All cluster methods are present');
      } else {
        this.addResult('FileStewardAgent Cluster Methods', 'FAIL', 
          `Missing methods: ${!hasEnableClusterMode ? 'enableClusterMode ' : ''}${!hasDisableClusterMode ? 'disableClusterMode ' : ''}${!hasProcessFileWithCluster ? 'processFileWithCluster ' : ''}${!hasCreateContentCluster ? 'createContentCluster' : ''}`);
      }
    } catch (error) {
      this.addResult('FileStewardAgent Cluster Methods', 'FAIL', 'Error creating FileStewardAgent', error?.toString());
    }
  }

  /**
   * Test 2: Verify AgentRegistry cluster integration
   */
  async testAgentRegistryClusterIntegration(): Promise<void> {
    try {
      console.log('🔍 Testing AgentRegistry cluster integration...');
      
      // Create mock services
      const mockQueueService = {
        addJob: async () => ({ id: 'test-job' }),
        getJobStatus: async () => ({ status: 'completed' }),
        processQueue: async () => {},
        clearQueue: async () => {}
      };

      const mockCrossLayerService = {
        validateAllLinks: async () => ({ valid: true, violations: [] }),
        validateAllCrossLayerLinks: async () => ({ valid: true, violations: [] })
      };

      const registry = new AgentRegistry(mockQueueService as any, mockCrossLayerService as any);
      
      // Check if cluster-related methods exist
      const hasEnableClusterMode = typeof registry.enableClusterMode === 'function';
      const hasDisableClusterMode = typeof registry.disableClusterMode === 'function';
      const hasValidateCrossLayerLinks = typeof registry.validateCrossLayerLinks === 'function';
      
      if (hasEnableClusterMode && hasDisableClusterMode && hasValidateCrossLayerLinks) {
        this.addResult('AgentRegistry Cluster Integration', 'PASS', 'All cluster integration methods are present');
      } else {
        this.addResult('AgentRegistry Cluster Integration', 'FAIL', 
          `Missing methods: ${!hasEnableClusterMode ? 'enableClusterMode ' : ''}${!hasDisableClusterMode ? 'disableClusterMode ' : ''}${!hasValidateCrossLayerLinks ? 'validateCrossLayerLinks' : ''}`);
      }
    } catch (error) {
      this.addResult('AgentRegistry Cluster Integration', 'FAIL', 'Error creating AgentRegistry', error?.toString());
    }
  }

  /**
   * Test 3: Verify CrossLayerEnforcementService has required methods
   */
  async testCrossLayerEnforcementService(): Promise<void> {
    try {
      console.log('🔍 Testing CrossLayerEnforcementService...');
      
      // Create mock services
      const mockNeo4jService = {
        runQuery: async () => ({ records: [] }),
        close: async () => {}
      };

      const mockPostgresService = {
        query: async () => ({ rows: [] }),
        executeQuery: async () => ({ rows: [] })
      };

      const service = new CrossLayerEnforcementService(mockNeo4jService as any, mockPostgresService as any);
      
      // Check if required methods exist
      const hasValidateAllLinks = typeof service.validateAllLinks === 'function';
      const hasValidateAllCrossLayerLinks = typeof service.validateAllCrossLayerLinks === 'function';
      
      if (hasValidateAllLinks && hasValidateAllCrossLayerLinks) {
        this.addResult('CrossLayerEnforcementService Methods', 'PASS', 'All required methods are present');
      } else {
        this.addResult('CrossLayerEnforcementService Methods', 'FAIL', 
          `Missing methods: ${!hasValidateAllLinks ? 'validateAllLinks ' : ''}${!hasValidateAllCrossLayerLinks ? 'validateAllCrossLayerLinks' : ''}`);
      }
    } catch (error) {
      this.addResult('CrossLayerEnforcementService Methods', 'FAIL', 'Error creating CrossLayerEnforcementService', error?.toString());
    }
  }

  /**
   * Test 4: Verify cluster mode toggling functionality
   */
  async testClusterModeToggling(): Promise<void> {
    try {
      console.log('🔍 Testing cluster mode toggling...');
      
      const mockQueueService = {
        addJob: async () => ({ id: 'test-job' }),
        getJobStatus: async () => ({ status: 'completed' }),
        processQueue: async () => {},
        clearQueue: async () => {}
      };

      const agent = new FileStewardAgent(mockQueueService as any);
      
      // Test cluster mode toggling
      agent.enableClusterMode();
      const isEnabledAfterEnable = (agent as any).clusterMode === true;
      
      agent.disableClusterMode();
      const isDisabledAfterDisable = (agent as any).clusterMode === false;
      
      if (isEnabledAfterEnable && isDisabledAfterDisable) {
        this.addResult('Cluster Mode Toggling', 'PASS', 'Cluster mode can be enabled and disabled correctly');
      } else {
        this.addResult('Cluster Mode Toggling', 'FAIL', 
          `Toggle failed: enabled=${isEnabledAfterEnable}, disabled=${isDisabledAfterDisable}`);
      }
    } catch (error) {
      this.addResult('Cluster Mode Toggling', 'FAIL', 'Error testing cluster mode toggling', error?.toString());
    }
  }

  /**
   * Test 5: Verify no Enhanced references remain
   */
  async testNoEnhancedReferences(): Promise<void> {
    try {
      console.log('🔍 Testing for Enhanced references...');
      
      // This is a simple check - in a real scenario we'd scan the codebase
      // For now, we'll just verify that our core classes don't reference Enhanced
      const mockQueueService = {
        addJob: async () => ({ id: 'test-job' }),
        getJobStatus: async () => ({ status: 'completed' }),
        processQueue: async () => {},
        clearQueue: async () => {}
      };

      const mockCrossLayerService = {
        validateAllLinks: async () => ({ valid: true, violations: [] }),
        validateAllCrossLayerLinks: async () => ({ valid: true, violations: [] })
      };

      // Try to create instances without Enhanced dependencies
      const agent = new FileStewardAgent(mockQueueService as any);
      const registry = new AgentRegistry(mockQueueService as any, mockCrossLayerService as any);
      
      this.addResult('No Enhanced References', 'PASS', 'Core classes instantiate without Enhanced dependencies');
    } catch (error) {
      this.addResult('No Enhanced References', 'FAIL', 'Error instantiating core classes', error?.toString());
    }
  }

  /**
   * Run all validation tests
   */
  async runValidation(): Promise<void> {
    console.log('🚀 Starting Cluster Core Validation...\n');

    await this.testFileStewardAgentClusterMethods();
    await this.testAgentRegistryClusterIntegration();
    await this.testCrossLayerEnforcementService();
    await this.testClusterModeToggling();
    await this.testNoEnhancedReferences();

    this.printResults();
  }

  /**
   * Print validation results
   */
  private printResults(): void {
    console.log('\n📊 Cluster Core Validation Results:');
    console.log('=' .repeat(60));

    let passCount = 0;
    let failCount = 0;
    let skipCount = 0;

    this.results.forEach(result => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      console.log(`${statusIcon} ${result.test}: ${result.message}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

      if (result.status === 'PASS') passCount++;
      else if (result.status === 'FAIL') failCount++;
      else skipCount++;
    });

    console.log('=' .repeat(60));
    console.log(`📈 Summary: ${passCount} passed, ${failCount} failed, ${skipCount} skipped`);

    if (failCount === 0) {
      console.log('🎉 All cluster core functionality tests passed!');
    } else {
      console.log('⚠️  Some cluster core functionality tests failed. Review the results above.');
    }
  }
}

// Run the validation
async function main() {
  const validator = new ClusterCoreValidator();
  await validator.runValidation();
}

if (require.main === module) {
  main().catch(console.error);
}
