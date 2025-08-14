export interface SourceMetadata {
    id: string;
    orgId: string;
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
    getSource(sourceId: string, orgId: string): Promise<SourceMetadata | null>;
    getSourcesByOrganization(orgId: string): Promise<SourceMetadata[]>;
    updateSourceConfig(sourceId: string, orgId: string, config: SourceConfig): Promise<boolean>;
    updateSourceStatus(sourceId: string, orgId: string, active: boolean): Promise<boolean>;
    deleteSource(sourceId: string, orgId: string): Promise<boolean>;
    syncToGraph(sourceData: SourceMetadata): Promise<void>;
    removeFromGraph(sourceId: string, orgId: string): Promise<void>;
    private mapRowToSource;
}
//# sourceMappingURL=Source.d.ts.map