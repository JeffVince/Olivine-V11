import { PostgresService } from '../../services/PostgresService';
import { Neo4jService } from '../../services/Neo4jService';
import { QueueService } from '../../services/queues/QueueService';
import { ContentExtractionService } from '../../services/extraction/ContentExtractionService';
import { PromotionService } from '../../services/extraction/PromotionService';
import { ClusterOrchestrator } from '../../services/orchestration/ClusterOrchestrator';
export interface ClusterResolverContext {
    postgresService: PostgresService;
    neo4jService: Neo4jService;
    queueService: QueueService;
    contentExtractionService: ContentExtractionService;
    promotionService: PromotionService;
    clusterOrchestrator: ClusterOrchestrator;
    user?: any;
}
export declare const clusterResolvers: {
    Query: {
        getContentCluster(_: any, { clusterId, organizationId }: {
            clusterId: string;
            organizationId: string;
        }, context: ClusterResolverContext): Promise<{
            id: any;
            orgId: any;
            fileId: any;
            fileName: any;
            projectId: any;
            status: any;
            entitiesCount: any;
            linksCount: any;
            crossLayerLinksCount: any;
            extractionMethod: any;
            confidence: any;
            createdAt: any;
            updatedAt: any;
            extractionJobs: {
                id: any;
                status: any;
                parserName: any;
                parserVersion: any;
                confidence: any;
                entitiesCount: number;
                linksCount: number;
                createdAt: any;
                completedAt: any;
                metadata: any;
            }[];
        } | null>;
        getContentClusters(_: any, { organizationId, fileId, projectId, limit, offset }: {
            organizationId: string;
            fileId?: string;
            projectId?: string;
            limit?: number;
            offset?: number;
        }, context: ClusterResolverContext): Promise<{
            id: any;
            orgId: any;
            fileId: any;
            fileName: any;
            projectId: any;
            status: any;
            entitiesCount: any;
            linksCount: any;
            crossLayerLinksCount: any;
            extractionMethod: any;
            confidence: any;
            createdAt: any;
            updatedAt: any;
        }[]>;
        getExtractionJob(_: any, { jobId, organizationId }: {
            jobId: string;
            organizationId: string;
        }, context: ClusterResolverContext): Promise<{
            id: any;
            orgId: any;
            fileId: any;
            fileName: any;
            projectId: any;
            status: any;
            parserName: any;
            parserVersion: any;
            method: any;
            confidence: any;
            createdAt: any;
            completedAt: any;
            promotedAt: any;
            metadata: any;
            stagedEntities: {
                id: any;
                kind: any;
                data: any;
                hash: any;
                confidence: any;
                sourceOffset: any;
                createdAt: any;
            }[];
            stagedLinks: {
                id: any;
                fromHash: any;
                toHash: any;
                relType: any;
                data: any;
                confidence: any;
                createdAt: any;
            }[];
            auditTrail: {
                id: any;
                actor: any;
                action: any;
                beforeJson: any;
                afterJson: any;
                timestamp: any;
            }[];
        } | null>;
        getExtractionJobs(_: any, { organizationId, fileId, status, limit, offset }: {
            organizationId: string;
            fileId?: string;
            status?: string;
            limit?: number;
            offset?: number;
        }, context: ClusterResolverContext): Promise<{
            id: any;
            orgId: any;
            fileId: any;
            fileName: any;
            projectId: any;
            status: any;
            parserName: any;
            parserVersion: any;
            method: any;
            confidence: any;
            entitiesCount: number;
            linksCount: number;
            createdAt: any;
            completedAt: any;
            promotedAt: any;
            metadata: any;
        }[]>;
        getParserRegistry(_: any, { organizationId }: {
            organizationId: string;
        }, context: ClusterResolverContext): Promise<{
            id: any;
            orgId: any;
            slot: any;
            mimeType: any;
            extension: any;
            parserName: any;
            parserVersion: any;
            minConfidence: any;
            featureFlag: any;
            enabled: any;
            createdAt: any;
            updatedAt: any;
        }[]>;
    };
    Mutation: {
        requestExtraction(_: any, { fileId, organizationId, parserName, slot }: {
            fileId: string;
            organizationId: string;
            parserName?: string;
            slot?: string;
        }, context: ClusterResolverContext): Promise<{
            success: boolean;
            extractionJobs: string[];
            message: string;
        }>;
        promoteExtraction(_: any, { jobId, organizationId, reviewNotes }: {
            jobId: string;
            organizationId: string;
            reviewNotes?: string;
        }, context: ClusterResolverContext): Promise<{
            success: boolean;
            message: string;
        }>;
        rollbackPromotion(_: any, { auditId, organizationId, reason }: {
            auditId: string;
            organizationId: string;
            reason: string;
        }, context: ClusterResolverContext): Promise<{
            success: boolean;
            message: string;
        }>;
        updateParserRegistry(_: any, { id, organizationId, enabled, minConfidence, featureFlag }: {
            id: string;
            organizationId: string;
            enabled?: boolean;
            minConfidence?: number;
            featureFlag?: boolean;
        }, context: ClusterResolverContext): Promise<{
            id: any;
            orgId: any;
            slot: any;
            mimeType: any;
            extension: any;
            parserName: any;
            parserVersion: any;
            minConfidence: any;
            featureFlag: any;
            enabled: any;
            createdAt: any;
            updatedAt: any;
        }>;
        startClusterWorkflow(_: any, { workflowName, organizationId, fileId, clusterId }: {
            workflowName: string;
            organizationId: string;
            fileId: string;
            clusterId: string;
        }, context: ClusterResolverContext): Promise<{
            success: boolean;
            workflowId: string;
            message: string;
        }>;
    };
};
export default clusterResolvers;
//# sourceMappingURL=clusterResolvers.d.ts.map