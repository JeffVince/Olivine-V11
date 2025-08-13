import { Neo4jService } from '../Neo4jService'
import { CryptoService } from '../crypto/CryptoService'

export interface CommitInput extends Record<string, unknown> {
  orgId: string
  message: string
  author: string
  authorType: 'user' | 'agent' | 'system'
  parentCommitId?: string
  branchName?: string
  metadata?: Record<string, any>
}

export interface ActionInput {
  actionType: string
  tool: string
  entityType: string
  entityId: string
  inputs?: any
  outputs?: any
  status: 'success' | 'failed'
  errorMessage?: string
  duration_ms?: number
  metadata?: Record<string, any>
}

export interface EntityUpdate {
  entity_id: string
  entity_type: string
  new_properties: Record<string, any>
  changes?: Record<string, any>
}

export interface EntityVersion {
  id: string
  entity_id: string
  entity_type: string
  props: Record<string, any>
  valid_from: Date
  valid_to?: Date
  tx_time: Date
  created_by_commit: string
  org_id: string
  metadata?: Record<string, any>
}

export interface EdgeFact {
  id: string
  type: string
  from_id: string
  to_id: string
  from_type?: string
  to_type?: string
  valid_from: Date
  valid_to?: Date
  created_by_commit: string
  ended_by_commit?: string
  org_id: string
  props?: Record<string, any>
  metadata?: Record<string, any>
}

export interface Branch {
  name: string
  org_id: string
  project_id?: string
  description: string
  created_from_commit?: string
  head_commit?: string
  status: 'active' | 'merged' | 'abandoned'
  created_by: string
  created_at: Date
  merged_at?: Date
  merged_by?: string
  metadata?: Record<string, any>
}

export interface ProvenanceResult {
  commit_id: string
  success: boolean
  entities_updated: number
  versions_created?: number
  edge_facts_created?: number
}

export class ProvenanceService {
  // TODO: Implementation Plan - 03-Knowledge-Graph-Implementation.md - Provenance service implementation for commit tracking
  // TODO: Implementation Plan - 05-Security-Implementation.md - Provenance service crypto integration
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend provenance service tests
  private readonly neo4j: Neo4jService
  private readonly crypto: CryptoService

  constructor(neo4j = new Neo4jService(), crypto = new CryptoService()) {
    this.neo4j = neo4j
    this.crypto = crypto
  }

  /**
   * Execute operation with full provenance tracking
   * Implements the atomic write pattern from 07-Provenance-Architecture.md
   */
  async executeWithProvenance(
    operation: string,
    entity_updates: EntityUpdate[],
    user_id: string,
    commit_message: string,
    tool_name: string,
    org_id: string
  ): Promise<ProvenanceResult> {
    const commit_id = this.generateId();
    
    const session = this.neo4j.getSession();
    try {
      const result = await session.executeWrite(async tx => {
        // Create commit and actions
        const commit_result = await tx.run(`
          CREATE (c:Commit {
            id: $commit_id,
            message: $message,
            author: $user_id,
            timestamp: datetime(),
            branch: 'main',
            org_id: $org_id,
            metadata: $metadata
          })
          RETURN c
        `, {
          commit_id,
          message: commit_message,
          user_id,
          org_id,
          metadata: { operation, tool_name }
        });

        const commit_node = commit_result.records[0]?.get('c');
        let entities_updated = 0;
        let versions_created = 0;

        // Process each entity update
        for (const update of entity_updates) {
          await this.applyEntityUpdate(tx, update, commit_id, tool_name, org_id);
          entities_updated++;
          versions_created++;
        }

        return {
          commit_id,
          success: true,
          entities_updated,
          versions_created
        };
      });

      return result;
    } catch (error) {
      console.error('Error in executeWithProvenance:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Apply single entity update with versioning
   * Implements atomic write pattern from architecture
   */
  private async applyEntityUpdate(
    tx: any, 
    update: EntityUpdate, 
    commit_id: string, 
    tool_name: string,
    org_id: string
  ): Promise<void> {
    const action_id = this.generateId();
    
    // Use atomic write pattern from 07-Provenance-Architecture.md
    const result = await tx.run(`
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: $tool_name,
        action_type: 'UPDATE_ENTITY',
        inputs: $inputs,
        outputs: $outputs,
        status: 'success',
        timestamp: datetime()
      })
      
      // Link to commit
      MATCH (c:Commit {id: $commit_id})
      CREATE (c)-[:INCLUDES]->(a)
      
      // Main entity operations
      MERGE (entity {id: $entity_id, org_id: $org_id})
      SET entity += $properties
      SET entity.updated_at = datetime()
      
      // End previous version
      OPTIONAL MATCH (entity)-[:HAS_VERSION]->(current_version:EntityVersion {valid_to: null})
      SET current_version.valid_to = datetime(),
          current_version.ended_by_commit = $commit_id
      
      // Create new version
      CREATE (new_version:EntityVersion {
        id: randomUUID(),
        entity_id: $entity_id,
        entity_type: $entity_type,
        props: $properties,
        valid_from: datetime(),
        valid_to: null,
        tx_time: datetime(),
        created_by_commit: $commit_id,
        org_id: $org_id
      })
      
      // Link entity to new version
      CREATE (entity)-[:HAS_VERSION]->(new_version)
      
      // Link action to entity for provenance
      CREATE (a)-[:TOUCHED]->(entity)
      
      RETURN entity, new_version
    `, {
      action_id,
      commit_id,
      tool_name,
      entity_id: update.entity_id,
      entity_type: update.entity_type,
      org_id,
      properties: update.new_properties,
      inputs: { entity_id: update.entity_id, changes: update.changes },
      outputs: { success: true }
    });
  }

  /**
   * Create EdgeFact for temporal relationships
   */
  async createEdgeFact(
    type: string,
    from_id: string,
    to_id: string,
    org_id: string,
    user_id: string,
    props?: Record<string, any>,
    from_type?: string,
    to_type?: string
  ): Promise<string> {
    const edge_fact_id = this.generateId();
    const commit_id = this.generateId();
    const action_id = this.generateId();

    const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created relationship: " + $type,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "provenance_service",
        action_type: "CREATE_EDGE_FACT",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      
      // Create EdgeFact
      CREATE (ef:EdgeFact {
        id: $edge_fact_id,
        type: $type,
        from_id: $from_id,
        to_id: $to_id,
        from_type: $from_type,
        to_type: $to_type,
        valid_from: datetime(),
        valid_to: null,
        created_by_commit: $commit_id,
        org_id: $org_id,
        props: $props
      })
      
      RETURN ef.id as id
    `;

    const result = await this.neo4j.executeQuery(query, {
      edge_fact_id,
      commit_id,
      action_id,
      type,
      from_id,
      to_id,
      from_type: from_type || null,
      to_type: to_type || null,
      org_id,
      user_id,
      props: props || {},
      inputs: { type, from_id, to_id },
      outputs: { edge_fact_id }
    }, org_id);

    return result.records[0]?.get('id');
  }

  /**
   * End an EdgeFact relationship
   */
  async endEdgeFact(edge_fact_id: string, org_id: string, user_id: string): Promise<void> {
    const commit_id = this.generateId();
    const action_id = this.generateId();

    const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Ended relationship",
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "provenance_service",
        action_type: "END_EDGE_FACT",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      
      // End EdgeFact
      MATCH (ef:EdgeFact {id: $edge_fact_id, org_id: $org_id, valid_to: null})
      SET ef.valid_to = datetime(),
          ef.ended_by_commit = $commit_id
      
      RETURN ef
    `;

    await this.neo4j.executeQuery(query, {
      commit_id,
      action_id,
      edge_fact_id,
      org_id,
      user_id,
      inputs: { edge_fact_id },
      outputs: { ended: true }
    }, org_id);
  }

  /**
   * Get entity at specific point in time
   */
  async getEntityAtTime(entity_id: string, timestamp: Date, org_id: string): Promise<Record<string, any> | null> {
    const query = `
      MATCH (e {id: $entity_id, org_id: $org_id})
      MATCH (e)-[:HAS_VERSION]->(v:EntityVersion)
      WHERE v.valid_from <= $timestamp
        AND (v.valid_to IS NULL OR v.valid_to > $timestamp)
      RETURN v.props as properties, v.valid_from as valid_from
    `;

    const result = await this.neo4j.executeQuery(query, {
      entity_id,
      timestamp,
      org_id
    }, org_id);

    return result.records[0]?.get('properties') || null;
  }

  /**
   * Get entity version history
   */
  async getEntityHistory(entity_id: string, entity_type: string, org_id: string): Promise<EntityVersion[]> {
    const query = `
      MATCH (e {id: $entity_id, org_id: $org_id})
      MATCH (e)-[:HAS_VERSION]->(v:EntityVersion)
      OPTIONAL MATCH (v)<-[:UPDATES]-(c:Commit)
      RETURN v, c.message as change_reason, c.author as changed_by
      ORDER BY v.valid_from
    `;

    const result = await this.neo4j.executeQuery(query, {
      entity_id,
      org_id
    }, org_id);

    return result.records.map((record: any) => {
      const version = record.get('v').properties;
      return {
        ...version,
        change_reason: record.get('change_reason'),
        changed_by: record.get('changed_by')
      };
    });
  }

  /**
   * Create a new branch
   */
  async createBranch(
    name: string,
    org_id: string,
    project_id: string | null,
    description: string,
    user_id: string,
    from_commit?: string
  ): Promise<Branch> {
    const query = `
      // Get main branch head commit if no from_commit specified
      OPTIONAL MATCH (main:Branch {name: "main", org_id: $org_id})
      WITH coalesce($from_commit, main.head_commit) as base_commit
      
      MERGE (new_branch:Branch {name: $name, org_id: $org_id})
      ON CREATE SET
        new_branch.project_id = $project_id,
        new_branch.description = $description,
        new_branch.created_from_commit = base_commit,
        new_branch.head_commit = base_commit,
        new_branch.status = "active",
        new_branch.created_by = $user_id,
        new_branch.created_at = datetime()
      RETURN new_branch
    `;

    const result = await this.neo4j.executeQuery(query, {
      name,
      org_id,
      project_id,
      description,
      user_id,
      from_commit: from_commit || null
    }, org_id);

    return result.records[0]?.get('new_branch').properties;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async createCommit(input: CommitInput): Promise<string> {
    const params = {
      ...input,
      parentCommitId: input.parentCommitId ?? null,
      branchName: input.branchName ?? 'main',
    }
    const commitId = (await this.neo4j.executeQuery(
      `
      WITH randomUUID() as id
      CREATE (c:Commit {
        id: id,
        org_id: $orgId,
        message: $message,
        author: $author,
        author_type: $authorType,
        created_at: datetime(),
        parent_commit_id: $parentCommitId,
        branch_name: coalesce($branchName, 'main')
      })
      RETURN c.id as id, c.org_id as orgId, c.message as message, c.author as author, c.author_type as authorType, c.created_at as createdAt, c.parent_commit_id as parentCommitId, c.branch_name as branchName
      `,
      params,
      input.orgId,
    )).records[0].get('id')

    const content = JSON.stringify({
      id: commitId,
      orgId: input.orgId,
      message: input.message,
      author: input.author,
      authorType: input.authorType,
      parentCommitId: input.parentCommitId,
      branchName: input.branchName ?? 'main',
    })
    const signature = this.crypto.sign(content)

    await this.neo4j.executeQuery(
      `MATCH (c:Commit {id: $commitId}) SET c.signature = $signature RETURN c`,
      { commitId, signature },
      input.orgId,
    )

    return commitId
  }

  async createAction(commitId: string, input: ActionInput, orgId: string): Promise<void> {
    await this.neo4j.executeQuery(
      `
      CREATE (a:Action {
        id: randomUUID(),
        commit_id: $commitId,
        action_type: $actionType,
        tool: $tool,
        entity_type: $entityType,
        entity_id: $entityId,
        inputs: $inputs,
        outputs: $outputs,
        status: $status,
        error_message: $errorMessage,
        created_at: datetime()
      })
      `,
      { commitId, ...input, inputs: JSON.stringify(input.inputs || {}), outputs: JSON.stringify(input.outputs || {}) },
      orgId,
    )
  }
}


