export interface FileMetadata {
    id: string;
    orgId: string;
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
    getFile(fileId: string, orgId: string): Promise<FileMetadata | null>;
    getFilesBySource(sourceId: string, orgId: string, limit?: number): Promise<FileMetadata[]>;
    deleteFile(fileId: string, orgId: string): Promise<boolean>;
    updateClassification(fileId: string, orgId: string, classification: FileClassification, status?: FileMetadata['classificationStatus']): Promise<boolean>;
    updateExtractedContent(fileId: string, orgId: string, extractedText: string): Promise<boolean>;
    syncToGraph(fileData: FileMetadata): Promise<void>;
    removeFromGraph(fileId: string, orgId: string): Promise<void>;
    private mapRowToFile;
}
//# sourceMappingURL=File.d.ts.map