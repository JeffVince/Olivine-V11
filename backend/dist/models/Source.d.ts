export interface SourceMetadata {
    id: string;
    organizationId: string;
    name: string;
    type: 'dropbox' | 'google_drive' | 'onedrive' | 'local';
    config: any;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface SourceConfig {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    dropboxAccountId?: string;
    dropboxTeamMemberId?: string;
    dropboxIsTeamAccount?: boolean;
    dropboxRootNamespaceId?: string;
    dropboxHomeNamespaceId?: string;
    googleClientId?: string;
    googleClientSecret?: string;
    googleScope?: string[];
    [key: string]: any;
}
export declare class SourceModel {
    private postgresService;
    private neo4jService;
    constructor();
    createSource(sourceData: Omit<SourceMetadata, 'id' | 'createdAt' | 'updatedAt'>): Promise<SourceMetadata>;
    getSource(sourceId: string, organizationId: string): Promise<SourceMetadata | null>;
    getSourcesByOrganization(organizationId: string): Promise<SourceMetadata[]>;
    updateSourceConfig(sourceId: string, organizationId: string, config: SourceConfig): Promise<boolean>;
    updateSourceStatus(sourceId: string, organizationId: string, active: boolean): Promise<boolean>;
    deleteSource(sourceId: string, organizationId: string): Promise<boolean>;
    syncToGraph(sourceData: SourceMetadata): Promise<void>;
    removeFromGraph(sourceId: string, organizationId: string): Promise<void>;
    private mapRowToSource;
}
//# sourceMappingURL=Source.d.ts.map