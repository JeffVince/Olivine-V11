import { FileMetadata } from '../../models/File';
export declare class FileResolvers {
    private fileModel;
    private sourceModel;
    private fileProcessingService;
    private eventProcessingService;
    constructor();
    getFiles(organizationId: string, sourceId?: string, limit?: number): Promise<FileMetadata[]>;
    getFile(fileId: string, organizationId: string): Promise<FileMetadata | null>;
    reprocessFile(fileId: string, organizationId: string): Promise<boolean>;
    getFileClassificationStatus(fileId: string, organizationId: string): Promise<string | null>;
    searchFiles(organizationId: string, query: string, sourceId?: string, mimeType?: string, limit?: number): Promise<FileMetadata[]>;
    getFileStats(organizationId: string): Promise<{
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