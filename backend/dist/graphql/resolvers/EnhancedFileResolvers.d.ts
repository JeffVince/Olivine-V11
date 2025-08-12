export interface FileFilter {
    orgId?: string;
    sourceId?: string;
    projectId?: string;
    classificationStatus?: string;
    mimeType?: string;
    path?: string;
    name?: string;
    sizeMin?: number;
    sizeMax?: number;
    modifiedAfter?: string;
    modifiedBefore?: string;
    createdAfter?: string;
    createdBefore?: string;
}
export interface FileSearchResults {
    results: Array<{
        file: any;
        score: number;
        highlights: string[];
    }>;
    totalCount: number;
    facets: any;
}
export declare class EnhancedFileResolvers {
    private neo4jService;
    private postgresService;
    private fileProcessingService;
    private classificationService;
    private queueService;
    private tenantService;
    private logger;
    private taxonomyService;
    constructor();
    getFile(id: string, orgId: string, context: any): Promise<any>;
    getFiles(filter: FileFilter | undefined, limit: number | undefined, offset: number | undefined, context: any): Promise<any[]>;
    searchFiles(orgId: string, query: string, filters: FileFilter | undefined, limit: number | undefined, context: any): Promise<FileSearchResults>;
    classifyFile(input: any, context: any): Promise<any>;
    triggerFileReprocessing(fileId: string, orgId: string, context: any): Promise<boolean>;
    bulkClassifyFiles(fileIds: string[], orgId: string, context: any): Promise<any[]>;
    getFileStats(orgId: string, context: any): Promise<any>;
    getFileVersions(fileId: string, orgId: string, context: any): Promise<any[]>;
    private buildSearchFilters;
    private generateHighlights;
    private getFacetsForSearch;
}
//# sourceMappingURL=EnhancedFileResolvers.d.ts.map