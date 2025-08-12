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