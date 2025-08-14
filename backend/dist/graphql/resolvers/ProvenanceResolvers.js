"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.provenanceResolvers = exports.ProvenanceResolvers = void 0;
const ProvenanceService_1 = require("../../services/provenance/ProvenanceService");
class ProvenanceResolvers {
    constructor() {
        this.provenanceService = new ProvenanceService_1.ProvenanceService();
    }
    getResolvers() {
        return {
            Query: {
                commits: async (_, { filter, limit }) => {
                    const orgId = filter?.orgId;
                    const branch = filter?.branchName || 'main';
                    if (!orgId)
                        return [];
                    const agentLike = this.provenanceService;
                    if (typeof agentLike.getCommitHistory === 'function') {
                        return await agentLike.getCommitHistory(orgId, branch, limit ?? 50);
                    }
                    const result = await this.provenanceService.neo4j.executeQuery(`MATCH (c:Commit {orgId: $orgId, branch_name: $branchName}) RETURN c ORDER BY c.created_at DESC LIMIT $limit`, { orgId, branchName: branch, limit: limit ?? 50 }, orgId);
                    return result.records.map((r) => {
                        const c = r.get('c').properties;
                        return {
                            id: c.id,
                            orgId: c.org_id,
                            message: c.message,
                            author: c.author,
                            authorType: c.author_type,
                            createdAt: c.created_at,
                            parentCommitId: c.parent_commit_id,
                            branchName: c.branch_name,
                            signature: c.signature,
                        };
                    });
                },
                commitHistory: async (_, { orgId, branchName, limit }) => {
                    const agentLike = this.provenanceService;
                    if (typeof agentLike.getCommitHistory === 'function') {
                        return await agentLike.getCommitHistory(orgId, branchName, limit ?? 50);
                    }
                    const result = await this.provenanceService.neo4j.executeQuery(`MATCH (c:Commit {orgId: $orgId, branch_name: $branchName}) RETURN c ORDER BY c.created_at DESC LIMIT $limit`, { orgId, branchName, limit: limit ?? 50 }, orgId);
                    return result.records.map((r) => {
                        const c = r.get('c').properties;
                        return {
                            id: c.id,
                            orgId: c.org_id,
                            message: c.message,
                            author: c.author,
                            authorType: c.author_type,
                            createdAt: c.created_at,
                            parentCommitId: c.parent_commit_id,
                            branchName: c.branch_name,
                            signature: c.signature,
                        };
                    });
                },
                branches: async (_, { orgId }) => {
                    const result = await this.provenanceService.neo4j.executeQuery(`MATCH (b:Branch {orgId: $orgId}) RETURN b ORDER BY b.created_at DESC`, { orgId }, orgId);
                    return result.records.map((r) => r.get('b').properties);
                },
                entityHistory: async (_, { entityId, entityType, orgId }) => {
                    return await this.provenanceService.getEntityHistory(entityId, entityType, orgId);
                },
                entityAtTime: async (_, { entityId, timestamp, orgId }) => {
                    return await this.provenanceService.getEntityAtTime(entityId, timestamp, orgId);
                }
            },
            Mutation: {
                createBranch: async (_, { name, orgId, projectId, description, userId, fromCommit }) => {
                    return await this.provenanceService.createBranch(name, orgId, projectId || null, description, userId, fromCommit);
                },
                createEdgeFact: async (_, { type, fromId, toId, orgId, userId, props, fromType, toType }) => {
                    const edgeFactId = await this.provenanceService.createEdgeFact(type, fromId, toId, orgId, userId, props, fromType, toType);
                    return { id: edgeFactId, success: true };
                },
                endEdgeFact: async (_, { edgeFactId, orgId, userId }) => {
                    await this.provenanceService.endEdgeFact(edgeFactId, orgId, userId);
                    return { success: true };
                }
            }
        };
    }
}
exports.ProvenanceResolvers = ProvenanceResolvers;
exports.provenanceResolvers = new ProvenanceResolvers().getResolvers();
//# sourceMappingURL=ProvenanceResolvers.js.map