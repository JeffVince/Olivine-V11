"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvenanceService = void 0;
const Neo4jService_1 = require("../Neo4jService");
const CryptoService_1 = require("../crypto/CryptoService");
class ProvenanceService {
    constructor(neo4j = new Neo4jService_1.Neo4jService(), crypto = new CryptoService_1.CryptoService()) {
        this.neo4j = neo4j;
        this.crypto = crypto;
    }
    async executeWithProvenance(operation, entity_updates, user_id, commit_message, tool_name, org_id) {
        const commit_id = this.generateId();
        const session = this.neo4j.getSession();
        try {
            const result = await session.executeWrite(async (tx) => {
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
        }
        catch (error) {
            console.error('Error in executeWithProvenance:', error);
            throw error;
        }
        finally {
            await session.close();
        }
    }
    async applyEntityUpdate(tx, update, commit_id, tool_name, org_id) {
        const action_id = this.generateId();
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
    async createEdgeFact(type, from_id, to_id, org_id, user_id, props, from_type, to_type) {
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
    async endEdgeFact(edge_fact_id, org_id, user_id) {
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
    async getEntityAtTime(entity_id, timestamp, org_id) {
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
    async getEntityHistory(entity_id, entity_type, org_id) {
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
        return result.records.map((record) => {
            const version = record.get('v').properties;
            return {
                ...version,
                change_reason: record.get('change_reason'),
                changed_by: record.get('changed_by')
            };
        });
    }
    async createBranch(name, org_id, project_id, description, user_id, from_commit) {
        const query = `
      // Get main branch head commit if no from_commit specified
      OPTIONAL MATCH (main:Branch {name: "main", org_id: $org_id})
      WITH coalesce($from_commit, main.head_commit) as base_commit
      
      CREATE (new_branch:Branch {
        name: $name,
        org_id: $org_id,
        project_id: $project_id,
        description: $description,
        created_from_commit: base_commit,
        head_commit: base_commit,
        status: "active",
        created_by: $user_id,
        created_at: datetime()
      })
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
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    async createCommit(input) {
        const commitId = (await this.neo4j.executeQuery(`
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
      `, input, input.orgId)).records[0].get('id');
        const content = JSON.stringify({
            id: commitId,
            orgId: input.orgId,
            message: input.message,
            author: input.author,
            authorType: input.authorType,
            parentCommitId: input.parentCommitId,
            branchName: input.branchName ?? 'main',
        });
        const signature = this.crypto.sign(content);
        await this.neo4j.executeQuery(`MATCH (c:Commit {id: $commitId}) SET c.signature = $signature RETURN c`, { commitId, signature }, input.orgId);
        return commitId;
    }
    async createAction(commitId, input, orgId) {
        await this.neo4j.executeQuery(`
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
      `, { commitId, ...input, inputs: JSON.stringify(input.inputs || {}), outputs: JSON.stringify(input.outputs || {}) }, orgId);
    }
}
exports.ProvenanceService = ProvenanceService;
//# sourceMappingURL=ProvenanceService.js.map