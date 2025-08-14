import { PostgresService } from '../../../services/PostgresService';
import { QueueService } from '../../../services/queues/QueueService';
export declare class ExtractionJobService {
    private postgres;
    private queues;
    constructor(postgres: PostgresService, queues: QueueService);
    queueExtractionJobs(orgId: string, fileId: string, slots: string[], fileMetadata: {
        mimeType: string;
    }): Promise<boolean>;
    private getApplicableParsers;
}
//# sourceMappingURL=ExtractionJobService.d.ts.map