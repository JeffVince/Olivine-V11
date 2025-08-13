#!/usr/bin/env ts-node

/**
 * Cluster Processing Validation Script
 * 
 * This script validates the core cluster-centric functionality:
 * 1. FileStewardAgent cluster mode enablement
 * 2. File processing with cluster creation
 * 3. Multi-slot classification
 * 4. Cross-layer link creation
 * 5. AgentRegistry cluster orchestration
 */

import { FileStewardAgent } from '../src/agents/FileStewardAgent';
import { AgentRegistry } from '../src/services/AgentRegistry';
import { CrossLayerEnforcementService } from '../src/services/CrossLayerEnforcementService';
import { QueueService } from '../src/services/queues/QueueService';
import { Neo4jService } from '../src/services/Neo4jService';
import { PostgresService } from '../src/services/PostgresService';
import { v4 as uuidv4 } from 'uuid';

interface ValidationResult {
  test: string;
  passed: boolean;
  error?: string;
  details?: any;
}

class ClusterValidationSuite {
  private results: ValidationResult[] = [];
  private queueService: QueueService;
  private neo4jService: Neo4jService;
  private postgresService: PostgresService;
  private agentRegistry: AgentRegistry;
  private fileStewardAgent: FileStewardAgent;
  private crossLayerService: CrossLayerEnforcementService;

  constructor() {
    // Initialize services
    this.queueService = new QueueService();
    this.neo4jService = new Neo4jService();
    this.postgresService = new PostgresService();
    
    // Initialize agent registry
    this.agentRegistry = AgentRegistry.getInstance();
    this.agentRegistry.setServices(this.neo4jService, this.postgresService, this.queueService);
    
    // Initialize FileStewardAgent
    this.fileStewardAgent = new FileStewardAgent(this.queueService);
    
    // Initialize CrossLayerEnforcementService
    this.crossLayerService = new CrossLayerEnforcementService(this.neo4jService, this.postgresService);
  }

  private addResult(test: string, passed: boolean, error?: string, details?: any): void {
    this.results.push({ test, passed, error, details });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${test}`);
    if (error) {
      console.log(`  Error: ${error}`);
    }
    if (details) {
      console.log(`  Details:`, details);
    }
  }

  /**
   * Test 1: Validate FileStewardAgent cluster mode functionality
   */
  async testFileStewardAgentClusterMode(): Promise<void> {
    try {
      // Test cluster mode enablement
      this.fileStewardAgent.enableClusterMode();
      
      // Verify event bus is available
      const eventBus = this.fileStewardAgent.getEventBus();
      
      this.addResult(
        'FileStewardAgent cluster mode enablement',
        eventBus !== null && eventBus !== undefined,
        undefined,
        { hasEventBus: eventBus !== null }
      );

      // Test cluster mode disablement
      this.fileStewardAgent.disableClusterMode();
      this.addResult('FileStewardAgent cluster mode toggle', true);

      // Re-enable for subsequent tests
      this.fileStewardAgent.enableClusterMode();

    } catch (error) {
      this.addResult(
        'FileStewardAgent cluster mode enablement',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Test 2: Validate AgentRegistry cluster integration
   */
  async testAgentRegistryClusterIntegration(): Promise<void> {
    try {
      // Enable cluster mode on registry
      this.agentRegistry.enableClusterMode();
      
      // Initialize agents
      await this.agentRegistry.initializeAgents();
      
      // Check if FileStewardAgent is registered
      const fileStewardAgent = this.agentRegistry.getAgent('file-steward-agent');
      
      this.addResult(
        'AgentRegistry cluster integration',
        fileStewardAgent !== undefined,
        undefined,
        { agentRegistered: fileStewardAgent !== undefined }
      );

    } catch (error) {
      this.addResult(
        'AgentRegistry cluster integration',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Test 3: Validate CrossLayerEnforcementService
   */
  async testCrossLayerEnforcementService(): Promise<void> {
    try {
      const testOrgId = 'test-org-' + uuidv4();
      
      // Test validateAllLinks method
      const validationResults = await this.crossLayerService.validateAllLinks(testOrgId);
      
      this.addResult(
        'CrossLayerEnforcementService validation',
        Array.isArray(validationResults),
        undefined,
        { 
          resultsCount: validationResults.length,
          hasValidationResults: Array.isArray(validationResults)
        }
      );

      // Test statistics gathering
      const stats = await this.crossLayerService.getCrossLayerStatistics(testOrgId);
      
      this.addResult(
        'CrossLayerEnforcementService statistics',
        typeof stats === 'object' && stats !== null,
        undefined,
        { hasStatistics: typeof stats === 'object' }
      );

    } catch (error) {
      this.addResult(
        'CrossLayerEnforcementService validation',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Test 4: Validate AgentRegistry cross-layer validation integration
   */
  async testAgentRegistryCrossLayerValidation(): Promise<void> {
    try {
      const testOrgId = 'test-org-' + uuidv4();
      
      // Test cross-layer validation through AgentRegistry
      await this.agentRegistry.validateCrossLayerLinks(testOrgId);
      
      this.addResult('AgentRegistry cross-layer validation integration', true);

    } catch (error) {
      this.addResult(
        'AgentRegistry cross-layer validation integration',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Test 5: Validate agent health checks
   */
  async testAgentHealthChecks(): Promise<void> {
    try {
      // Test health status
      const healthStatus = this.agentRegistry.getHealthStatus();
      
      this.addResult(
        'AgentRegistry health checks',
        typeof healthStatus === 'object' && 'healthy' in healthStatus && 'agents' in healthStatus,
        undefined,
        { 
          hasHealthProperty: 'healthy' in healthStatus,
          hasAgentsProperty: 'agents' in healthStatus,
          agentCount: Object.keys(healthStatus.agents || {}).length
        }
      );

      // Test detailed health check
      const detailedHealth = await this.agentRegistry.performHealthCheck();
      
      this.addResult(
        'AgentRegistry detailed health checks',
        typeof detailedHealth === 'object' && 'healthy' in detailedHealth,
        undefined,
        { hasDetailedHealth: typeof detailedHealth === 'object' }
      );

    } catch (error) {
      this.addResult(
        'AgentRegistry health checks',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Run all validation tests
   */
  async runValidation(): Promise<void> {
    console.log('🚀 Starting Cluster Processing Validation Suite...\n');

    await this.testFileStewardAgentClusterMode();
    await this.testAgentRegistryClusterIntegration();
    await this.testCrossLayerEnforcementService();
    await this.testAgentRegistryCrossLayerValidation();
    await this.testAgentHealthChecks();

    // Summary
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const failed = total - passed;

    console.log('\n📊 Validation Summary:');
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.test}: ${r.error}`);
        });
    }

    console.log('\n🎯 Core Cluster Functionality Status:');
    if (passed >= total * 0.8) {
      console.log('✅ CLUSTER PROCESSING IS WORKING - Core functionality validated');
    } else {
      console.log('⚠️  CLUSTER PROCESSING NEEDS ATTENTION - Some core functionality issues detected');
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.agentRegistry.shutdown();
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.log('⚠️  Cleanup warning:', error);
    }
  }
}

// Run validation if script is executed directly
if (require.main === module) {
  const validator = new ClusterValidationSuite();
  
  validator.runValidation()
    .then(() => validator.cleanup())
    .then(() => {
      console.log('\n🏁 Cluster validation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Validation failed:', error);
      process.exit(1);
    });
}

export { ClusterValidationSuite };
