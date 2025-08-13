import { EventProcessingService } from './EventProcessingService';
import { FileClassification } from '../models/File';
export interface FileProcessingJobData {
    fileId: string;
    organizationId: string;
    sourceId: string;
    filePath: string;
    action: 'create' | 'update' | 'delete';
    metadata?: Record<string, unknown>;
}
export declare class FileProcessingService {
    private eventProcessingService;
    private fileModel;
    private sourceModel;
    private dropboxService;
    private googleDriveService;
    constructor(eventProcessingService: EventProcessingService);
    extractContent(params: {
        orgId: string;
        sourceId: string;
        path: string;
        mimeType: string;
    } | string, path?: string, mimeType?: string, orgIdParam?: string): Promise<string>;
    processFileChange(jobData: FileProcessingJobData): Promise<void>;
    private handleFileCreateOrUpdate;
    private handleFileDelete;
    private queueFileForClassification;
    private queueFileForExtraction;
    private downloadFileContent;
    private downloadFromDropbox;
    private downloadFromGoogleDrive;
    private isTextMimeType;
    private streamToBuffer;
    private extractFileName;
    private extractFileExtension;
    private determineMimeType;
    private shouldProcessForClassification;
    private shouldProcessForExtraction;
    getProcessingStatistics(orgId: string): Promise<{
        total_files: number;
        classified_files: number;
        classification_rate: number;
    }>;
    processFileWithAI(fileRequest: {
        fileId: string;
        orgId: string;
        content: string;
        mimeType: string;
    }): Promise<{
        fileId: string;
        classification: FileClassification;
        extractedText: string;
    }>;
}
//# sourceMappingURL=FileProcessingService.d.ts.map