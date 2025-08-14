import { 
  ProvenanceService,
  EntityUpdate,
  EntityVersion,
  Branch
} from '../../services/provenance/ProvenanceService';

export class ProvenanceResolvers {
  private provenanceService: ProvenanceService;

  constructor() {
    this.provenanceService = new ProvenanceService();
  }

  getResolvers() {
    return {
      Query: {
        // Provide commits and commitHistory queries expected by frontend
        commits: async (
          _: any,
          { filter, limit }: { filter?: { orgId?: string; branchName?: string }; limit?: number }
        ) => {
          const orgId = filter?.orgId as string | undefined
          const branch = (filter?.branchName as string | undefined) || 'main'
          if (!orgId) return []
          const agentLike: any = (this.provenanceService as any)
          if (typeof agentLike.getCommitHistory === 'function') {
            return await agentLike.getCommitHistory(orgId, branch, limit ?? 50)
          }
          const result = await (this.provenanceService as any).neo4j.executeQuery(
            `MATCH (c:Commit {org_id: $orgId, branch_name: $branchName}) RETURN c ORDER BY c.created_at DESC LIMIT $limit`,
            { orgId, branchName: branch, limit: limit ?? 50 },
            orgId
          )
          return result.records.map((r: any) => {
            const c = r.get('c').properties
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
            }
          })
        },

        commitHistory: async (
          _: any,
          { orgId, branchName, limit }: { orgId: string; branchName: string; limit?: number }
        ) => {
          const agentLike: any = (this.provenanceService as any)
          if (typeof agentLike.getCommitHistory === 'function') {
            return await agentLike.getCommitHistory(orgId, branchName, limit ?? 50)
          }
          const result = await (this.provenanceService as any).neo4j.executeQuery(
            `MATCH (c:Commit {org_id: $orgId, branch_name: $branchName}) RETURN c ORDER BY c.created_at DESC LIMIT $limit`,
            { orgId, branchName, limit: limit ?? 50 },
            orgId
          )
          return result.records.map((r: any) => {
            const c = r.get('c').properties
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
            }
          })
        },

        branches: async (
          _: any,
          { orgId }: { orgId: string }
        ) => {
          const result = await (this.provenanceService as any).neo4j.executeQuery(
            `MATCH (b:Branch {org_id: $orgId}) RETURN b ORDER BY b.created_at DESC`,
            { orgId },
            orgId
          )
          return result.records.map((r: any) => r.get('b').properties)
        },
        entityHistory: async (
          _: any, 
          { entityId, entityType, orgId }: { entityId: string; entityType: string; orgId: string }
        ) => {
          return await this.provenanceService.getEntityHistory(entityId, entityType, orgId);
        },

        entityAtTime: async (
          _: any,
          { entityId, timestamp, orgId }: { entityId: string; timestamp: Date; orgId: string }
        ) => {
          return await this.provenanceService.getEntityAtTime(entityId, timestamp, orgId);
        }
      },

      Mutation: {
        createBranch: async (
          _: any,
          { name, orgId, projectId, description, userId, fromCommit }: {
            name: string;
            orgId: string;
            projectId?: string;
            description: string;
            userId: string;
            fromCommit?: string;
          }
        ) => {
          return await this.provenanceService.createBranch(
            name, 
            orgId, 
            projectId || null, 
            description, 
            userId, 
            fromCommit
          );
        },

        createEdgeFact: async (
          _: any,
          { type, fromId, toId, orgId, userId, props, fromType, toType }: {
            type: string;
            fromId: string;
            toId: string;
            orgId: string;
            userId: string;
            props?: Record<string, any>;
            fromType?: string;
            toType?: string;
          }
        ) => {
          const edgeFactId = await this.provenanceService.createEdgeFact(
            type,
            fromId,
            toId,
            orgId,
            userId,
            props,
            fromType,
            toType
          );
          return { id: edgeFactId, success: true };
        },

        endEdgeFact: async (
          _: any,
          { edgeFactId, orgId, userId }: { edgeFactId: string; orgId: string; userId: string }
        ) => {
          await this.provenanceService.endEdgeFact(edgeFactId, orgId, userId);
          return { success: true };
        }
      }
    };
  }
}

export const provenanceResolvers = new ProvenanceResolvers().getResolvers();
