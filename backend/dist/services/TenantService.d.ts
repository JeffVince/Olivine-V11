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
    close(): Promise<void>;
}
//# sourceMappingURL=TenantService.d.ts.map