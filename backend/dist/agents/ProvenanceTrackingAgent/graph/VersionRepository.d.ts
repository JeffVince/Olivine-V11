import { Neo4jService } from '../../../services/Neo4jService';
export declare class VersionRepository {
    private neo4j;
    constructor(neo4jService: Neo4jService);
    getExistingVersion(orgId: string, entityId: string, contentHash: string): Promise<string | null>;
    createVersion(params: {
        versionId: string;
        orgId: string;
        entityId: string;
        entityType: string;
        properties: string;
        commitId: string;
        createdAt: string;
        contentHash: string;
    }): Promise<string>;
    createEntityVersionRelationship(entityId: string, versionId: string, orgId: string): Promise<void>;
    getEntityVersionHistory(orgId: string, entityId: string): Promise<any[]>;
}
//# sourceMappingURL=VersionRepository.d.ts.map