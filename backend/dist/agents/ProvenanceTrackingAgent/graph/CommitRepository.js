"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommitRepository = void 0;
class CommitRepository {
    constructor(neo4jService) {
        this.neo4j = neo4jService;
    }
    async createCommit(params) {
        const query = `
      CREATE (c:Commit {
        id: $commitId,
        org_id: $orgId,
        message: $message,
        author: $author,
        author_type: $authorType,
        created_at: datetime($createdAt),
        parent_commit_id: $parentCommitId,
        branch_name: $branchName,
        signature: $signature,
        metadata: $metadataJson
      })
      RETURN c.id as commitId
    `;
        await this.neo4j.run(query, params);
        return params.commitId;
    }
    async addParentRelationship(parentCommitId, childCommitId, orgId) {
        const query = `
      MATCH (parent:Commit {id: $parentCommitId, org_id: $orgId})
      MATCH (child:Commit {id: $childCommitId, org_id: $orgId})
      CREATE (parent)-[:PARENT_OF {org_id: $orgId, created_at: datetime()}]->(child)
    `;
        await this.neo4j.run(query, { parentCommitId, childCommitId, orgId });
    }
    async addCommitActionRelationship(commitId, actionId, orgId) {
        const query = `
      MATCH (c:Commit {id: $commitId})
      MATCH (a:Action {id: $actionId})
      CREATE (c)-[:CONTAINS {org_id: $orgId, created_at: datetime()}]->(a)
    `;
        await this.neo4j.run(query, { commitId, actionId, orgId });
    }
    async getCommitById(commitId) {
        const query = `
      MATCH (c:Commit {id: $commitId})
      RETURN c
    `;
        const result = await this.neo4j.run(query, { commitId });
        if (result.records.length === 0)
            return null;
        const commit = result.records[0].get('c').properties;
        return {
            id: commit.id,
            orgId: commit.org_id,
            message: commit.message,
            author: commit.author,
            authorType: commit.author_type,
            createdAt: commit.created_at,
            parentCommitId: commit.parent_commit_id,
            branchName: commit.branch_name,
            signature: commit.signature,
            metadata: commit.metadata
        };
    }
    async getCommitHistory(orgId, branchName, limit = 50) {
        const query = `
      MATCH (c:Commit {org_id: $orgId, branch_name: $branchName})
      OPTIONAL MATCH (c)<-[:PART_OF]-(a:Action)
      RETURN c, collect(a) as actions
      ORDER BY c.created_at DESC
      LIMIT $limit
    `;
        const result = await this.neo4j.run(query, { orgId, branchName, limit });
        return result.records.map((record) => {
            const commit = record.get('c').properties;
            const actions = record.get('actions').map((action) => action.properties);
            return {
                id: commit.id,
                orgId: commit.org_id,
                message: commit.message,
                author: commit.author,
                authorType: commit.author_type,
                createdAt: commit.created_at,
                parentCommitId: commit.parent_commit_id,
                branchName: commit.branch_name,
                signature: commit.signature,
                metadata: JSON.parse(commit.metadata || '{}'),
                actions
            };
        });
    }
}
exports.CommitRepository = CommitRepository;
//# sourceMappingURL=CommitRepository.js.map