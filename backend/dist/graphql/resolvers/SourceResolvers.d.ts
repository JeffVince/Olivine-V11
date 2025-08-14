import { SourceMetadata, SourceConfig } from '../../models/Source';
export declare class SourceResolvers {
    private sourceModel;
    private fileModel;
    private fileProcessingService;
    private eventProcessingService;
    private dropboxService;
    private googleDriveService;
    constructor();
    getSources(orgId: string): Promise<SourceMetadata[]>;
    getSource(sourceId: string, orgId: string): Promise<SourceMetadata | null>;
    createSource(orgId: string, name: string, type: 'dropbox' | 'google_drive' | 'onedrive' | 'local', config: SourceConfig): Promise<SourceMetadata>;
    updateSourceConfig(sourceId: string, orgId: string, config: SourceConfig): Promise<boolean>;
    updateSourceStatus(sourceId: string, orgId: string, active: boolean): Promise<boolean>;
    deleteSource(sourceId: string, orgId: string): Promise<boolean>;
    getSourceStats(sourceId: string, orgId: string): Promise<{
        fileCount: number;
        totalSize: number;
        lastSync: Date | null;
        classificationStats: {
            [status: string]: number;
        };
    }>;
    triggerSourceResync(sourceId: string, orgId: string): Promise<boolean>;
    testSourceConnection(sourceId: string, orgId: string): Promise<{
        success: boolean;
        message: string;
        details?: any;
    }>;
}
//# sourceMappingURL=SourceResolvers.d.ts.map