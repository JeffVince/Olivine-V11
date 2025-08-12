import { SourceMetadata, SourceConfig } from '../../models/Source';
export declare class SourceResolvers {
    private sourceModel;
    private fileModel;
    private eventProcessingService;
    private dropboxService;
    private googleDriveService;
    constructor();
    getSources(organizationId: string): Promise<SourceMetadata[]>;
    getSource(sourceId: string, organizationId: string): Promise<SourceMetadata | null>;
    createSource(organizationId: string, name: string, type: 'dropbox' | 'google_drive' | 'onedrive' | 'local', config: SourceConfig): Promise<SourceMetadata>;
    updateSourceConfig(sourceId: string, organizationId: string, config: SourceConfig): Promise<boolean>;
    updateSourceStatus(sourceId: string, organizationId: string, active: boolean): Promise<boolean>;
    deleteSource(sourceId: string, organizationId: string): Promise<boolean>;
    getSourceStats(sourceId: string, organizationId: string): Promise<{
        fileCount: number;
        totalSize: number;
        lastSync: Date | null;
        classificationStats: {
            [status: string]: number;
        };
    }>;
    triggerSourceResync(sourceId: string, organizationId: string): Promise<boolean>;
    testSourceConnection(sourceId: string, organizationId: string): Promise<{
        success: boolean;
        message: string;
        details?: any;
    }>;
}
//# sourceMappingURL=SourceResolvers.d.ts.map