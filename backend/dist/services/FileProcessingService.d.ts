import { EventProcessingService } from './EventProcessingService';
export interface FileProcessingJobData {
    fileId: string;
    organizationId: string;
    sourceId: string;
    filePath: string;
    action: 'create' | 'update' | 'delete';
    metadata?: any;
}
export declare class FileProcessingService {
    private eventProcessingService;
    private fileModel;
    private sourceModel;
    private dropboxService;
    private googleDriveService;
    constructor(eventProcessingService: EventProcessingService);
    extractContent(params: {
        sourceId: string;
        path: string;
        mimeType: string;
    } | string, path?: string, mimeType?: string): Promise<string>;
    processFileChange(jobData: FileProcessingJobData): Promise<void>;
    private handleFileCreateOrUpdate;
    private handleFileDelete;
    private queueFileForClassification;
    private queueFileForExtraction;
    private downloadFileContent;
    private downloadFromDropbox;
    private downloadFromGoogleDrive;
    private extractFileName;
    private extractFileExtension;
    private determineMimeType;
    private shouldProcessForClassification;
    private shouldProcessForExtraction;
}
//# sourceMappingURL=FileProcessingService.d.ts.map