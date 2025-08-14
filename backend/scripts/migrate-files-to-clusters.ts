#!/usr/bin/env ts-node

/**
 * Migration Script: Migrate Files to Clusters
 * 
 * This script implements the cluster migration requirements from cluster implementation.md:
 * - Creates ContentCluster placeholders for all existing files (J1)
 * - Converts legacy single classifications to EdgeFacts (J2)
 * - Maps cross-layer edges where possible (J3)
 * 
 * Usage: npm run migrate:clusters [--dry-run] [--batch-size=1000] [--org-id=<uuid>]
 */

import { Neo4jService } from '../src/services/Neo4jService';
import { PostgresService } from '../src/services/PostgresService';
import { v4 as uuidv4 } from 'uuid';
import { Command } from 'commander';

interface MigrationStats {
  filesProcessed: number;
  clustersCreated: number;
  edgeFactsCreated: number;
  crossLayerLinksCreated: number;
  errors: number;
}

interface FileRecord {
  id: string;
  org_id: string;
  project_id?: string;
  path: string;
  name: string;
  mime_type: string;
  classification_status: string;
  extracted_text?: string;
}

class ClusterMigrationService {
  private neo4jService: Neo4jService;
  private postgresService: PostgresService;
  private dryRun: boolean;
  private batchSize: number;
  private stats: MigrationStats;

  constructor(dryRun = false, batchSize = 1000) {
    this.neo4jService = new Neo4jService();
    this.postgresService = new PostgresService();
    this.dryRun = dryRun;
    this.batchSize = batchSize;
    this.stats = {
      filesProcessed: 0,
      clustersCreated: 0,
      edgeFactsCreated: 0,
      crossLayerLinksCreated: 0,
      errors: 0
    };
  }

  /**
   * Run the complete migration process
   */
  async runMigration(orgId?: string): Promise<MigrationStats> {
    console.log(`🚀 Starting cluster migration ${this.dryRun ? '(DRY RUN)' : ''}`);
    console.log(`📊 Batch size: ${this.batchSize}`);
    if (orgId) {
      console.log(`🏢 Organization filter: ${orgId}`);
    }

    try {
      // Step 1: Backfill cluster placeholders for all files
      await this.backfillClusterPlaceholders(orgId);

      // Step 2: Convert legacy classifications to EdgeFacts
      await this.convertLegacyClassifications(orgId);

      // Step 3: Create cross-layer links where possible
      await this.createCrossLayerLinks(orgId);

      // Step 4: Update cluster statistics
      await this.updateClusterStatistics(orgId);

      console.log('\n✅ Migration completed successfully!');
      this.printStats();

      return this.stats;

    } catch (error) {
      console.error('\n❌ Migration failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Step 1: Create ContentCluster placeholders for all existing files
   */
  private async backfillClusterPlaceholders(orgId?: string): Promise<void> {
    console.log('\n📁 Step 1: Creating ContentCluster placeholders...');

    let whereClause = '';
    const params: any[] = [];
    
    if (orgId) {
      whereClause = 'WHERE f.org_id = $1';
      params.push(orgId);
    }

    // Get files that don't have clusters yet
    const query = `
      MATCH (f:File)
      ${whereClause}
      WHERE NOT (f)-[:HAS_CLUSTER]->(:ContentCluster)
      RETURN f.id as id, f.org_id as org_id, f.project_id as project_id,
             f.path as path, f.name as name, f.mime_type as mime_type,
             f.classification_status as classification_status,
             f.extracted_text as extracted_text
      ORDER BY f.created_at
    `;

    const result = await this.neo4jService.run(query, params);
    const files = result.records.map(record => ({
      id: record.get('id'),
      org_id: record.get('org_id'),
      project_id: record.get('project_id'),
      path: record.get('path'),
      name: record.get('name'),
      mime_type: record.get('mime_type'),
      classification_status: record.get('classification_status'),
      extracted_text: record.get('extracted_text')
    }));

    console.log(`📊 Found ${files.length} files without clusters`);

    // Process files in batches
    for (let i = 0; i < files.length; i += this.batchSize) {
      const batch = files.slice(i, i + this.batchSize);
      await this.processBatchCreateClusters(batch);
      
      console.log(`✅ Processed ${Math.min(i + this.batchSize, files.length)}/${files.length} files`);
    }
  }

  /**
   * Process batch of files to create clusters
   */
  private async processBatchCreateClusters(files: FileRecord[]): Promise<void> {
    const session = this.neo4jService.getSession();
    const transaction = session.beginTransaction();

    try {
      for (const file of files) {
        const clusterId = uuidv4();
        
        if (!this.dryRun) {
          // Create ContentCluster node
          await transaction.run(`
            MATCH (f:File {id: $fileId})
            CREATE (cc:ContentCluster {
              id: $clusterId,
              orgId: $orgId,
              fileId: $fileId,
              projectId: $projectId,
              status: 'empty',
              entitiesCount: 0,
              linksCount: 0,
              crossLayerLinksCount: 0,
              extractionMethod: null,
              confidence: null,
              createdAt: datetime(),
              updatedAt: datetime(),
              migratedAt: datetime()
            })
            CREATE (f)-[:HAS_CLUSTER]->(cc)
          `, {
            fileId: file.id,
            clusterId,
            orgId: file.org_id,
            projectId: file.project_id
          });

          // Create corresponding PostgreSQL record
          await this.postgresService.query(`
            INSERT INTO content_cluster (
              id, org_id, file_id, project_id, status, 
              entities_count, links_count, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, 'empty', 0, 0, NOW(), NOW())
            ON CONFLICT (file_id) DO NOTHING
          `, [clusterId, file.org_id, file.id, file.project_id]);
        }

        this.stats.clustersCreated++;
        this.stats.filesProcessed++;
      }

      if (!this.dryRun) {
        await transaction.commit();
      } else {
        await transaction.rollback();
      }

    } catch (error) {
      await transaction.rollback();
      this.stats.errors++;
      console.error('❌ Batch processing failed:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Step 2: Convert legacy single classifications to EdgeFacts
   */
  private async convertLegacyClassifications(orgId?: string): Promise<void> {
    console.log('\n🏷️  Step 2: Converting legacy classifications to EdgeFacts...');

    let whereClause = '';
    const params: any[] = [];
    
    if (orgId) {
      whereClause = 'WHERE f.org_id = $1';
      params.push(orgId);
    }

    // Find files with classification_status but no EdgeFacts
    const query = `
      MATCH (f:File)
      ${whereClause}
      WHERE f.classification_status IS NOT NULL 
      AND f.classification_status <> 'PENDING'
      AND NOT (f)<-[:FILLS_SLOT]-(:EdgeFact)
      RETURN f.id as id, f.org_id as org_id, f.classification_status as status,
             f.path as path, f.mime_type as mime_type
    `;

    const result = await this.neo4jService.run(query, params);
    const files = result.records.map(record => ({
      id: record.get('id'),
      org_id: record.get('org_id'),
      classification_status: record.get('status'),
      path: record.get('path'),
      mime_type: record.get('mime_type')
    }));

    console.log(`📊 Found ${files.length} files with legacy classifications`);

    // Process files in batches
    for (let i = 0; i < files.length; i += this.batchSize) {
      const batch = files.slice(i, i + this.batchSize);
      await this.processBatchConvertClassifications(batch);
      
      console.log(`✅ Converted ${Math.min(i + this.batchSize, files.length)}/${files.length} classifications`);
    }
  }

  /**
   * Process batch of files to convert classifications
   */
  private async processBatchConvertClassifications(files: any[]): Promise<void> {
    const session = this.neo4jService.getSession();
    const transaction = session.beginTransaction();

    try {
      for (const file of files) {
        const slot = this.mapLegacyClassificationToSlot(file.classification_status);
        if (!slot) continue;

        const edgeFactId = uuidv4();
        const confidence = this.calculateMigrationConfidence(file);

        if (!this.dryRun) {
          await transaction.run(`
            MATCH (f:File {id: $fileId})
            CREATE (ef:EdgeFact {
              id: $edgeFactId,
              type: 'FILLS_SLOT',
              props: {
                slot: $slot,
                confidence: $confidence,
                ruleId: 'legacy-migration',
                method: 'legacy_conversion'
              },
              orgId: $orgId,
              createdAt: datetime(),
              validFrom: datetime(),
              validTo: null,
              migratedAt: datetime()
            })
            CREATE (f)<-[:FILLS_SLOT]-(ef)
          `, {
            fileId: file.id,
            edgeFactId,
            slot,
            confidence,
            orgId: file.org_id
          });
        }

        this.stats.edgeFactsCreated++;
      }

      if (!this.dryRun) {
        await transaction.commit();
      } else {
        await transaction.rollback();
      }

    } catch (error) {
      await transaction.rollback();
      this.stats.errors++;
      console.error('❌ Classification conversion failed:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Step 3: Create cross-layer links where possible
   */
  private async createCrossLayerLinks(orgId?: string): Promise<void> {
    console.log('\n🔗 Step 3: Creating cross-layer links...');

    // Link script files to scenes
    await this.linkScriptFilesToScenes(orgId);

    // Link budget files to purchase orders
    await this.linkBudgetFilesToPurchaseOrders(orgId);

    // Link call sheet files to shoot days
    await this.linkCallSheetFilesToShootDays(orgId);
  }

  /**
   * Link script files to existing scenes
   */
  private async linkScriptFilesToScenes(orgId?: string): Promise<void> {
    let whereClause = '';
    const params: any[] = [];
    
    if (orgId) {
      whereClause = 'AND f.org_id = $1';
      params.push(orgId);
    }

    const query = `
      MATCH (f:File)-[:FILLS_SLOT]->(ef:EdgeFact)
      WHERE ef.props.slot = 'SCRIPT_PRIMARY' ${whereClause}
      MATCH (f)-[:BELONGS_TO]->(p:Project)
      MATCH (p)<-[:BELONGS_TO]-(s:Scene)
      WHERE NOT (f)-[:SCRIPT_FOR]->(s)
      RETURN f.id as fileId, collect(s.id) as sceneIds
      LIMIT 100
    `;

    const result = await this.neo4jService.run(query, params);
    
    for (const record of result.records) {
      const fileId = record.get('fileId');
      const sceneIds = record.get('sceneIds');

      if (!this.dryRun) {
        for (const sceneId of sceneIds.slice(0, 10)) { // Limit to avoid too many links
          await this.neo4jService.run(`
            MATCH (f:File {id: $fileId}), (s:Scene {id: $sceneId})
            CREATE (f)-[:SCRIPT_FOR {
              createdAt: datetime(),
              createdBy: 'cluster-migration',
              method: 'automatic'
            }]->(s)
          `, { fileId, sceneId });

          this.stats.crossLayerLinksCreated++;
        }
      } else {
        this.stats.crossLayerLinksCreated += Math.min(sceneIds.length, 10);
      }
    }
  }

  /**
   * Link budget files to purchase orders
   */
  private async linkBudgetFilesToPurchaseOrders(orgId?: string): Promise<void> {
    let whereClause = '';
    const params: any[] = [];
    
    if (orgId) {
      whereClause = 'AND f.org_id = $1';
      params.push(orgId);
    }

    const query = `
      MATCH (f:File)-[:FILLS_SLOT]->(ef:EdgeFact)
      WHERE ef.props.slot = 'BUDGET_MASTER' ${whereClause}
      MATCH (f)-[:BELONGS_TO]->(p:Project)
      MATCH (p)<-[:BELONGS_TO]-(po:PurchaseOrder)
      WHERE NOT (f)-[:BUDGET_FOR]->(po)
      RETURN f.id as fileId, collect(po.id) as poIds
      LIMIT 50
    `;

    const result = await this.neo4jService.run(query, params);
    
    for (const record of result.records) {
      const fileId = record.get('fileId');
      const poIds = record.get('poIds');

      if (!this.dryRun) {
        for (const poId of poIds.slice(0, 5)) { // Limit to avoid too many links
          await this.neo4jService.run(`
            MATCH (f:File {id: $fileId}), (po:PurchaseOrder {id: $poId})
            CREATE (f)-[:BUDGET_FOR {
              createdAt: datetime(),
              createdBy: 'cluster-migration',
              method: 'automatic'
            }]->(po)
          `, { fileId, poId });

          this.stats.crossLayerLinksCreated++;
        }
      } else {
        this.stats.crossLayerLinksCreated += Math.min(poIds.length, 5);
      }
    }
  }

  /**
   * Link call sheet files to shoot days
   */
  private async linkCallSheetFilesToShootDays(orgId?: string): Promise<void> {
    let whereClause = '';
    const params: any[] = [];
    
    if (orgId) {
      whereClause = 'AND f.org_id = $1';
      params.push(orgId);
    }

    const query = `
      MATCH (f:File)-[:FILLS_SLOT]->(ef:EdgeFact)
      WHERE ef.props.slot = 'CALLSHEET_FINAL' ${whereClause}
      MATCH (f)-[:BELONGS_TO]->(p:Project)
      MATCH (p)<-[:BELONGS_TO]-(sd:ShootDay)
      WHERE NOT (f)-[:CALLSHEET_FOR]->(sd)
      RETURN f.id as fileId, collect(sd.id) as shootDayIds
      LIMIT 50
    `;

    const result = await this.neo4jService.run(query, params);
    
    for (const record of result.records) {
      const fileId = record.get('fileId');
      const shootDayIds = record.get('shootDayIds');

      if (!this.dryRun) {
        for (const shootDayId of shootDayIds.slice(0, 3)) { // Limit to avoid too many links
          await this.neo4jService.run(`
            MATCH (f:File {id: $fileId}), (sd:ShootDay {id: $shootDayId})
            CREATE (f)-[:CALLSHEET_FOR {
              createdAt: datetime(),
              createdBy: 'cluster-migration',
              method: 'automatic'
            }]->(sd)
          `, { fileId, shootDayId });

          this.stats.crossLayerLinksCreated++;
        }
      } else {
        this.stats.crossLayerLinksCreated += Math.min(shootDayIds.length, 3);
      }
    }
  }

  /**
   * Step 4: Update cluster statistics
   */
  private async updateClusterStatistics(orgId?: string): Promise<void> {
    console.log('\n📈 Step 4: Updating cluster statistics...');

    let whereClause = '';
    const params: any[] = [];
    
    if (orgId) {
      whereClause = 'WHERE cc.orgId = $1';
      params.push(orgId);
    }

    if (!this.dryRun) {
      // Update cross-layer links count for clusters
      await this.neo4jService.run(`
        MATCH (cc:ContentCluster)<-[:HAS_CLUSTER]-(f:File)
        ${whereClause}
        WITH cc, f, 
             size((f)-[:SCRIPT_FOR|BUDGET_FOR|CALLSHEET_FOR]->()) as crossLayerCount
        SET cc.crossLayerLinksCount = crossLayerCount,
            cc.updatedAt = datetime()
      `, params);

      // Update PostgreSQL cluster statistics
      await this.postgresService.query(`
        UPDATE content_cluster 
        SET updated_at = NOW()
        ${orgId ? 'WHERE org_id = $1' : ''}
      `, orgId ? [orgId] : []);
    }

    console.log('✅ Cluster statistics updated');
  }

  /**
   * Map legacy classification status to canonical slot
   */
  private mapLegacyClassificationToSlot(status: string): string | null {
    const mapping: Record<string, string> = {
      'SCRIPT': 'SCRIPT_PRIMARY',
      'BUDGET': 'BUDGET_MASTER',
      'CALLSHEET': 'CALLSHEET_FINAL',
      'SCHEDULE': 'SCHEDULE_MASTER',
      'STORYBOARD': 'STORYBOARD_PRIMARY',
      'DOCUMENT': 'DOCUMENT_GENERAL',
      'IMAGE': 'MEDIA_IMAGE',
      'VIDEO': 'MEDIA_VIDEO',
      'AUDIO': 'MEDIA_AUDIO'
    };

    return mapping[status] || null;
  }

  /**
   * Calculate confidence for migrated classifications
   */
  private calculateMigrationConfidence(file: { path: string }): number {
    let confidence = 0.6; // Base confidence for legacy data

    // Boost confidence based on file name patterns
    const fileName = file.path.toLowerCase();
    if (fileName.includes('script') || fileName.endsWith('.fdx')) {
      confidence += 0.2;
    }
    if (fileName.includes('budget') || fileName.endsWith('.xlsx')) {
      confidence += 0.1;
    }
    if (fileName.includes('call') && fileName.includes('sheet')) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Print migration statistics
   */
  private printStats(): void {
    console.log('\n📊 Migration Statistics:');
    console.log(`   Files processed: ${this.stats.filesProcessed}`);
    console.log(`   Clusters created: ${this.stats.clustersCreated}`);
    console.log(`   EdgeFacts created: ${this.stats.edgeFactsCreated}`);
    console.log(`   Cross-layer links created: ${this.stats.crossLayerLinksCreated}`);
    console.log(`   Errors: ${this.stats.errors}`);
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    await this.neo4jService.close();
    await this.postgresService.close();
  }
}

// CLI Interface
async function main() {
  const program = new Command();

  program
    .name('migrate-files-to-clusters')
    .description('Migrate existing files to cluster-centric model')
    .option('--dry-run', 'Run migration without making changes', false)
    .option('--batch-size <size>', 'Batch size for processing', '1000')
    .option('--org-id <uuid>', 'Filter by organization ID')
    .action(async (options) => {
      const migrationService = new ClusterMigrationService(
        options.dryRun,
        parseInt(options.batchSize)
      );

      try {
        await migrationService.runMigration(options.orgId);
        process.exit(0);
      } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
      }
    });

  program.parse();
}

if (require.main === module) {
  main().catch(console.error);
}

export { ClusterMigrationService, MigrationStats };
