import { Request, Response } from 'express';
import { QueueService } from '../services/queues/QueueService';
export declare class DropboxWebhookHandler {
    private postgresService;
    private queueService;
    private configService;
    private fileProcessingService;
    private eventProcessingService;
    private webhookSecret;
    constructor(queueService: QueueService);
    private validateSignature;
    handleWebhook(req: Request, res: Response): Promise<void>;
    private processDeltaChanges;
    private processFileEntry;
    private handleModifiedFile;
    private handleDeletedFile;
    private handleCursorReset;
    private handleFullListing;
    private storeCursor;
    private storeDropboxEvent;
}
//# sourceMappingURL=DropboxWebhookHandler.d.ts.map