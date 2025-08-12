export interface FileMetadata {
    id: string;
    organizationId: string;
    sourceId: string;
    path: string;
    name: string;
    extension?: string;
    mimeType?: string;
    size?: number;
    createdAt: Date;
    updatedAt: Date;
    modifiedAt?: Date;
    deletedAt?: Date;
    versionId?: string;
    metadata?: any;
    classificationStatus: 'pending' | 'processing' | 'completed' | 'failed';
    extractedText?: string;
}
export interface FileClassification {
    type: string;
    confidence: number;
    categories: string[];
    tags: string[];
}
export interface FileContent {
    text?: string;
    metadata?: any;
    extractedAt: Date;
}
export declare class FileModel {
    private postgresService;
    private neo4jService;
    constructor();
    upsertFile(fileData: Partial<FileMetadata>): Promise<FileMetadata>;
    getFile(fileId: string, organizationId: string): Promise<FileMetadata | null>;
    getFilesBySource(sourceId: string, organizationId: string, limit?: number): Promise<FileMetadata[]>;
    deleteFile(fileId: string, organizationId: string): Promise<boolean>;
    updateClassification(fileId: string, organizationId: string, classification: FileClassification, status?: FileMetadata['classificationStatus']): Promise<boolean>;
    updateExtractedContent(fileId: string, organizationId: string, extractedText: string): Promise<boolean>;
    syncToGraph(fileData: FileMetadata): Promise<void>;
    removeFromGraph(fileId: string, organizationId: string): Promise<void>;
    private mapRowToFile;
}
//# sourceMappingURL=File.d.ts.map