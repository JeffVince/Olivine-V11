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
    private processGoogleDriveChanges;
    private processFileChange;
    private getGoogleDriveService;
    private getFilePath;
    private storeGoogleDriveEvent;
    private getSourceFromChannel;
    private getStoredCredentials;
    private getStoredPageToken;
    private updateStoredPageToken;
    setupPushNotifications(sourceId: string, orgId: string): Promise<void>;
    private updateSourceWebhookInfo;
}
//# sourceMappingURL=GoogleDriveWebhookHandler.d.ts.map