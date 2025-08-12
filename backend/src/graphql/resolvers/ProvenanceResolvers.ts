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
