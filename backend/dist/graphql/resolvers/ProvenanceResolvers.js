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
                    const organizationId = filter?.organizationId;
                    const branch = filter?.branchName || 'main';
                    if (!organizationId)
                        return [];
                    const agentLike = this.provenanceService;
                    if (typeof agentLike.getCommitHistory === 'function') {
                        return await agentLike.getCommitHistory(organizationId, branch, limit ?? 50);
                    }
                    const result = await this.provenanceService.neo4j.executeQuery(`MATCH (c:Commit {organization_id: $organizationId, branch_name: $branchName}) RETURN c ORDER BY c.created_at DESC LIMIT $limit`, { organizationId, branchName: branch, limit: limit ?? 50 }, organizationId);
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
                commitHistory: async (_, { organizationId, branchName, limit }) => {
                    const agentLike = this.provenanceService;
                    if (typeof agentLike.getCommitHistory === 'function') {
                        return await agentLike.getCommitHistory(organizationId, branchName, limit ?? 50);
                    }
                    const result = await this.provenanceService.neo4j.executeQuery(`MATCH (c:Commit {organization_id: $organizationId, branch_name: $branchName}) RETURN c ORDER BY c.created_at DESC LIMIT $limit`, { organizationId, branchName, limit: limit ?? 50 }, organizationId);
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
                branches: async (_, { organizationId }) => {
                    const result = await this.provenanceService.neo4j.executeQuery(`MATCH (b:Branch {organization_id: $organizationId}) RETURN b ORDER BY b.created_at DESC`, { organizationId }, organizationId);
                    return result.records.map((r) => r.get('b').properties);
                },
                entityHistory: async (_, { entityId, entityType, organizationId }) => {
                    return await this.provenanceService.getEntityHistory(entityId, entityType, organizationId);
                },
                entityAtTime: async (_, { entityId, timestamp, organizationId }) => {
                    return await this.provenanceService.getEntityAtTime(entityId, timestamp, organizationId);
                }
            },
            Mutation: {
                createBranch: async (_, { name, organizationId, projectId, description, userId, fromCommit }) => {
                    return await this.provenanceService.createBranch(name, organizationId, projectId || null, description, userId, fromCommit);
                },
                createEdgeFact: async (_, { type, fromId, toId, organizationId, userId, props, fromType, toType }) => {
                    const edgeFactId = await this.provenanceService.createEdgeFact(type, fromId, toId, organizationId, userId, props, fromType, toType);
                    return { id: edgeFactId, success: true };
                },
                endEdgeFact: async (_, { edgeFactId, organizationId, userId }) => {
                    await this.provenanceService.endEdgeFact(edgeFactId, organizationId, userId);
                    return { success: true };
                }
            }
        };
    }
}
exports.ProvenanceResolvers = ProvenanceResolvers;
exports.provenanceResolvers = new ProvenanceResolvers().getResolvers();
//# sourceMappingURL=ProvenanceResolvers.js.map