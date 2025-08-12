import { Request, Response } from 'express';
export interface GraphQLContext {
    req: Request;
    res: Response;
    user?: any;
    organization?: any;
    permissions?: string[];
    requestId?: string;
}
export declare class SecurityMiddleware {
    private authService;
    private tenantService;
    private rateLimitService;
    private auditService;
    private logger;
    constructor();
    createContext({ req, res }: {
        req: Request;
        res: Response;
    }): Promise<GraphQLContext>;
    createFieldAuthMiddleware(): {
        requireOrgAccess: (requiredPermission?: string) => (resolve: any, parent: any, args: any, context: GraphQLContext, info: any) => Promise<any>;
        requireAdmin: () => (resolve: any, parent: any, args: any, context: GraphQLContext, info: any) => Promise<any>;
        requireProjectAccess: (permission?: string) => (resolve: any, parent: any, args: any, context: GraphQLContext, info: any) => Promise<any>;
        rateLimit: (config: {
            windowMs: number;
            maxRequests: number;
        }) => (resolve: any, parent: any, args: any, context: GraphQLContext, info: any) => Promise<any>;
    };
    createDataFilterMiddleware(): {
        enforceOrgScope: () => (resolve: any, parent: any, args: any, context: GraphQLContext, info: any) => Promise<any>;
        filterResults: () => (resolve: any, parent: any, args: any, context: GraphQLContext, info: any) => Promise<any>;
    };
    createAuditMiddleware(): {
        logMutations: () => (resolve: any, parent: any, args: any, context: GraphQLContext, info: any) => Promise<any>;
    };
    createValidationMiddleware(): {
        validateInput: (schema: any) => (resolve: any, parent: any, args: any, context: GraphQLContext, info: any) => Promise<any>;
        sanitizeInput: () => (resolve: any, parent: any, args: any, context: GraphQLContext, info: any) => Promise<any>;
    };
    private extractAuthToken;
    private isIntrospectionQuery;
    private extractOperationName;
    private generateRequestId;
    private hasAccessToItem;
    private sanitizeArgs;
    private sanitizeInputRecursive;
}
//# sourceMappingURL=SecurityMiddleware.d.ts.map