import { Request, Response } from 'express';
import { QueueService } from '../services/queues/QueueService';
export declare class GoogleDriveWebhookHandler {
    private postgresService;
    private queueService;
    private configService;
    private fileProcessingService;
    private eventProcessingService;
    constructor(queueService: QueueService);
    handleWebhook(req: Request, res: Response): Promise<void>;
    private findSourceByChannelId;
    private getStoredPageToken;
    private processGoogleDriveChanges;
    private processChanges;
    private initializePageToken;
    private processGoogleDriveFileChange;
    private handleGoogleDriveFileCreateOrUpdate;
    private handleGoogleDriveFileDelete;
    private buildFilePath;
    private handleDeletedFile;
    private storePageToken;
    private getGoogleDriveClient;
    private processFileChange;
    private handleModifiedFile;
}
//# sourceMappingURL=GoogleDriveWebhookHandler.d.ts.map