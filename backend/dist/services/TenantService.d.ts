export interface Organization {
    id: string;
    name: string;
    description?: string;
    status: 'active' | 'suspended' | 'archived';
    created_at: Date;
    updated_at: Date;
    metadata?: Record<string, any>;
}
export interface UserPermission {
    userId: string;
    orgId: string;
    role: string;
    permissions: string[];
}
export interface Migration {
    version: string;
    description: string;
    steps: MigrationStep[];
}
export interface MigrationStep {
    type: 'constraint' | 'index' | 'data_migration';
    query: string;
    description?: string;
}
export interface MigrationHistory {
    version: string;
    description: string;
    applied_at: Date;
    org_id: string;
}
export declare class TenantService {
    private neo4jService;
    constructor();
    validateOrgId(orgId: string): boolean;
    addOrgIdToParams(params: Record<string, any>, orgId: string): Record<string, any>;
    createTenantQueryTemplate(query: string): string;
    executeTenantQuery(query: string, params: Record<string, any> | undefined, orgId: string): Promise<any>;
    validateAccess(user: any, orgId: string): Promise<void>;
    getOrganization(orgId: string): Promise<any>;
    getUserPermissions(userId: string, orgId: string): Promise<string[]>;
    validateCrossOrgAccess(userId: string, targetOrgId: string): Promise<boolean>;
    validateProjectAccess(userId: string, orgId: string, projectId: string): Promise<boolean>;
    createOrganization(orgData: Omit<Organization, 'id' | 'created_at' | 'updated_at'>): Promise<Organization>;
    updateOrganization(orgId: string, updateData: Partial<Omit<Organization, 'id' | 'created_at'>>): Promise<Organization>;
    getUserOrganizations(userId: string): Promise<Organization[]>;
    addUserToOrganization(userId: string, orgId: string, role?: string): Promise<void>;
    removeUserFromOrganization(userId: string, orgId: string): Promise<void>;
    getUserRole(userId: string, orgId: string): Promise<string | null>;
    validateTenantContext(userId: string, orgId: string, requiredRole?: string): Promise<boolean>;
    private hasRequiredRole;
    applyMigrations(orgId: string, targetVersion?: string): Promise<void>;
    private getCurrentSchemaVersion;
    private getPendingMigrations;
    private applyMigration;
    private addTenantContextToMigration;
    private loadMigrationFiles;
    private compareVersions;
    private generateUUID;
    validateDataIntegrity(orgId: string): Promise<{
        valid: boolean;
        errors: string[];
    }>;
    getMigrationHistory(orgId: string): Promise<MigrationHistory[]>;
    close(): Promise<void>;
}
//# sourceMappingURL=TenantService.d.ts.map