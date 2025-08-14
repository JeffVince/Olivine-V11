import { FileProcessingService } from '../../../services/FileProcessingService';
export declare class Extractor {
    private fileProcessingService;
    constructor(fileProcessingService: FileProcessingService);
    extractContent(params: {
        orgId: string;
        sourceId?: string;
        path: string;
        mimeType: string;
    }): Promise<{
        text: string;
        metadata: Record<string, unknown>;
    }>;
}
//# sourceMappingURL=Extractor.d.ts.map