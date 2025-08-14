import { Neo4jService } from '../../../services/Neo4jService';
export declare class FileRepository {
    private neo4j;
    constructor(neo4jService: Neo4jService);
    upsertFileNode(params: {
        orgId: string;
        sourceId: string;
        resourcePath: string;
        dbId: string;
        name: string;
        size: number;
        mimeType: string;
        checksum?: string | null;
        modified: string;
        metadataJson: string;
    }): Promise<string>;
    getFileNode(orgId: string, sourceId: string, path: string): Promise<{
        id: string;
        properties: any;
    } | null>;
    updateFileNode(fileId: string, params: {
        name: string;
        size: number;
        mimeType: string;
        checksum?: string | null;
        modified: string;
        metadataJson: string;
    }): Promise<void>;
    softDeleteFileNode(fileId: string): Promise<void>;
}
//# sourceMappingURL=FileRepository.d.ts.map