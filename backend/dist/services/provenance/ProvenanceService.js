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