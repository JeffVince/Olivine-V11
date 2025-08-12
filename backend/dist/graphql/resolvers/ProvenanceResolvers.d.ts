import { EntityVersion, Branch } from '../../services/provenance/ProvenanceService';
export declare class ProvenanceResolvers {
    private provenanceService;
    constructor();
    getResolvers(): {
        Query: {
            entityHistory: (_: any, { entityId, entityType, orgId }: {
                entityId: string;
                entityType: string;
                orgId: string;
            }) => Promise<EntityVersion[]>;
            entityAtTime: (_: any, { entityId, timestamp, orgId }: {
                entityId: string;
                timestamp: Date;
                orgId: string;
            }) => Promise<Record<string, any> | null>;
        };
        Mutation: {
            createBranch: (_: any, { name, orgId, projectId, description, userId, fromCommit }: {
                name: string;
                orgId: string;
                projectId?: string;
                description: string;
                userId: string;
                fromCommit?: string;
            }) => Promise<Branch>;
            createEdgeFact: (_: any, { type, fromId, toId, orgId, userId, props, fromType, toType }: {
                type: string;
                fromId: string;
                toId: string;
                orgId: string;
                userId: string;
                props?: Record<string, any>;
                fromType?: string;
                toType?: string;
            }) => Promise<{
                id: string;
                success: boolean;
            }>;
            endEdgeFact: (_: any, { edgeFactId, orgId, userId }: {
                edgeFactId: string;
                orgId: string;
                userId: string;
            }) => Promise<{
                success: boolean;
            }>;
        };
    };
}
export declare const provenanceResolvers: {
    Query: {
        entityHistory: (_: any, { entityId, entityType, orgId }: {
            entityId: string;
            entityType: string;
            orgId: string;
        }) => Promise<EntityVersion[]>;
        entityAtTime: (_: any, { entityId, timestamp, orgId }: {
            entityId: string;
            timestamp: Date;
            orgId: string;
        }) => Promise<Record<string, any> | null>;
    };
    Mutation: {
        createBranch: (_: any, { name, orgId, projectId, description, userId, fromCommit }: {
            name: string;
            orgId: string;
            projectId?: string;
            description: string;
            userId: string;
            fromCommit?: string;
        }) => Promise<Branch>;
        createEdgeFact: (_: any, { type, fromId, toId, orgId, userId, props, fromType, toType }: {
            type: string;
            fromId: string;
            toId: string;
            orgId: string;
            userId: string;
            props?: Record<string, any>;
            fromType?: string;
            toType?: string;
        }) => Promise<{
            id: string;
            success: boolean;
        }>;
        endEdgeFact: (_: any, { edgeFactId, orgId, userId }: {
            edgeFactId: string;
            orgId: string;
            userId: string;
        }) => Promise<{
            success: boolean;
        }>;
    };
};
//# sourceMappingURL=ProvenanceResolvers.d.ts.map