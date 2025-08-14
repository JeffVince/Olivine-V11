import { EntityVersion, Branch } from '../../services/provenance/ProvenanceService';
export declare class ProvenanceResolvers {
    private provenanceService;
    constructor();
    getResolvers(): {
        Query: {
            commits: (_: any, { filter, limit }: {
                filter?: {
                    organizationId?: string;
                    branchName?: string;
                };
                limit?: number;
            }) => Promise<any>;
            commitHistory: (_: any, { organizationId, branchName, limit }: {
                organizationId: string;
                branchName: string;
                limit?: number;
            }) => Promise<any>;
            branches: (_: any, { organizationId }: {
                organizationId: string;
            }) => Promise<any>;
            entityHistory: (_: any, { entityId, entityType, organizationId }: {
                entityId: string;
                entityType: string;
                organizationId: string;
            }) => Promise<EntityVersion[]>;
            entityAtTime: (_: any, { entityId, timestamp, organizationId }: {
                entityId: string;
                timestamp: Date;
                organizationId: string;
            }) => Promise<Record<string, any> | null>;
        };
        Mutation: {
            createBranch: (_: any, { name, organizationId, projectId, description, userId, fromCommit }: {
                name: string;
                organizationId: string;
                projectId?: string;
                description: string;
                userId: string;
                fromCommit?: string;
            }) => Promise<Branch>;
            createEdgeFact: (_: any, { type, fromId, toId, organizationId, userId, props, fromType, toType }: {
                type: string;
                fromId: string;
                toId: string;
                organizationId: string;
                userId: string;
                props?: Record<string, any>;
                fromType?: string;
                toType?: string;
            }) => Promise<{
                id: string;
                success: boolean;
            }>;
            endEdgeFact: (_: any, { edgeFactId, organizationId, userId }: {
                edgeFactId: string;
                organizationId: string;
                userId: string;
            }) => Promise<{
                success: boolean;
            }>;
        };
    };
}
export declare const provenanceResolvers: {
    Query: {
        commits: (_: any, { filter, limit }: {
            filter?: {
                organizationId?: string;
                branchName?: string;
            } | undefined;
            limit?: number;
        }) => Promise<any>;
        commitHistory: (_: any, { organizationId, branchName, limit }: {
            organizationId: string;
            branchName: string;
            limit?: number;
        }) => Promise<any>;
        branches: (_: any, { organizationId }: {
            organizationId: string;
        }) => Promise<any>;
        entityHistory: (_: any, { entityId, entityType, organizationId }: {
            entityId: string;
            entityType: string;
            organizationId: string;
        }) => Promise<EntityVersion[]>;
        entityAtTime: (_: any, { entityId, timestamp, organizationId }: {
            entityId: string;
            timestamp: Date;
            organizationId: string;
        }) => Promise<Record<string, any> | null>;
    };
    Mutation: {
        createBranch: (_: any, { name, organizationId, projectId, description, userId, fromCommit }: {
            name: string;
            organizationId: string;
            projectId?: string;
            description: string;
            userId: string;
            fromCommit?: string;
        }) => Promise<Branch>;
        createEdgeFact: (_: any, { type, fromId, toId, organizationId, userId, props, fromType, toType }: {
            type: string;
            fromId: string;
            toId: string;
            organizationId: string;
            userId: string;
            props?: Record<string, any>;
            fromType?: string;
            toType?: string;
        }) => Promise<{
            id: string;
            success: boolean;
        }>;
        endEdgeFact: (_: any, { edgeFactId, organizationId, userId }: {
            edgeFactId: string;
            organizationId: string;
            userId: string;
        }) => Promise<{
            success: boolean;
        }>;
    };
};
//# sourceMappingURL=ProvenanceResolvers.d.ts.map