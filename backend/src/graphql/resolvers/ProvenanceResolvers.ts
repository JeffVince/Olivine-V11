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
          { filter, limit }: { filter?: { organizationId?: string; branchName?: string }; limit?: number }
        ) => {
          const organizationId = filter?.organizationId as string | undefined
          const branch = (filter?.branchName as string | undefined) || 'main'
          if (!organizationId) return []
          const agentLike: any = (this.provenanceService as any)
          if (typeof agentLike.getCommitHistory === 'function') {
            return await agentLike.getCommitHistory(organizationId, branch, limit ?? 50)
          }
          const result = await (this.provenanceService as any).neo4j.executeQuery(
            `MATCH (c:Commit {organization_id: $organizationId, branch_name: $branchName}) RETURN c ORDER BY c.created_at DESC LIMIT $limit`,
            { organizationId, branchName: branch, limit: limit ?? 50 },
            organizationId
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
          { organizationId, branchName, limit }: { organizationId: string; branchName: string; limit?: number }
        ) => {
          const agentLike: any = (this.provenanceService as any)
          if (typeof agentLike.getCommitHistory === 'function') {
            return await agentLike.getCommitHistory(organizationId, branchName, limit ?? 50)
          }
          const result = await (this.provenanceService as any).neo4j.executeQuery(
            `MATCH (c:Commit {organization_id: $organizationId, branch_name: $branchName}) RETURN c ORDER BY c.created_at DESC LIMIT $limit`,
            { organizationId, branchName, limit: limit ?? 50 },
            organizationId
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
          { organizationId }: { organizationId: string }
        ) => {
          const result = await (this.provenanceService as any).neo4j.executeQuery(
            `MATCH (b:Branch {organization_id: $organizationId}) RETURN b ORDER BY b.created_at DESC`,
            { organizationId },
            organizationId
          )
          return result.records.map((r: any) => r.get('b').properties)
        },
        entityHistory: async (
          _: any, 
          { entityId, entityType, organizationId }: { entityId: string; entityType: string; organizationId: string }
        ) => {
          return await this.provenanceService.getEntityHistory(entityId, entityType, organizationId);
        },

        entityAtTime: async (
          _: any,
          { entityId, timestamp, organizationId }: { entityId: string; timestamp: Date; organizationId: string }
        ) => {
          return await this.provenanceService.getEntityAtTime(entityId, timestamp, organizationId);
        }
      },

      Mutation: {
        createBranch: async (
          _: any,
          { name, organizationId, projectId, description, userId, fromCommit }: {
            name: string;
            organizationId: string;
            projectId?: string;
            description: string;
            userId: string;
            fromCommit?: string;
          }
        ) => {
          return await this.provenanceService.createBranch(
            name, 
            organizationId, 
            projectId || null, 
            description, 
            userId, 
            fromCommit
          );
        },

        createEdgeFact: async (
          _: any,
          { type, fromId, toId, organizationId, userId, props, fromType, toType }: {
            type: string;
            fromId: string;
            toId: string;
            organizationId: string;
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
            organizationId,
            userId,
            props,
            fromType,
            toType
          );
          return { id: edgeFactId, success: true };
        },

        endEdgeFact: async (
          _: any,
          { edgeFactId, organizationId, userId }: { edgeFactId: string; organizationId: string; userId: string }
        ) => {
          await this.provenanceService.endEdgeFact(edgeFactId, organizationId, userId);
          return { success: true };
        }
      }
    };
  }
}

export const provenanceResolvers = new ProvenanceResolvers().getResolvers();
