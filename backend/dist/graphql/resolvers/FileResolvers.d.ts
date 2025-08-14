import { FileMetadata } from '../../models/File';
export declare class FileResolvers {
    private fileModel;
    private sourceModel;
    private fileProcessingService;
    private eventProcessingService;
    constructor();
    getFiles(orgId: string, sourceId?: string, limit?: number): Promise<FileMetadata[]>;
    getFile(fileId: string, orgId: string): Promise<FileMetadata | null>;
    reprocessFile(fileId: string, orgId: string): Promise<boolean>;
    getFileClassificationStatus(fileId: string, orgId: string): Promise<string | null>;
    searchFiles(orgId: string, query: string, sourceId?: string, mimeType?: string, limit?: number): Promise<FileMetadata[]>;
    getFileStats(orgId: string): Promise<{
        total: number;
        byStatus: {
            [status: string]: number;
        };
        byMimeType: {
            [mimeType: string]: number;
        };
    }>;
    private calculateRelevanceScore;
}
//# sourceMappingURL=FileResolvers.d.ts.map