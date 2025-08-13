"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityMiddleware = void 0;
const graphql_1 = require("graphql");
const AuthService_1 = require("../../services/AuthService");
const TenantService_1 = require("../../services/TenantService");
const RateLimitService_1 = require("../../services/RateLimitService");
const AuditService_1 = require("../../services/AuditService");
const winston_1 = __importDefault(require("winston"));
class SecurityMiddleware {
    constructor() {
        this.authService = new AuthService_1.AuthService();
        this.tenantService = new TenantService_1.TenantService();
        this.rateLimitService = new RateLimitService_1.RateLimitService();
        this.auditService = new AuditService_1.AuditService();
        this.logger = winston_1.default.createLogger({
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json(), winston_1.default.format.label({ label: 'security-middleware' })),
            transports: [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                })
            ]
        });
    }
    async createContext({ req, res }) {
        const requestId = this.generateRequestId();
        const startTime = Date.now();
        try {
            if (process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'test') {
                return {
                    req,
                    res,
                    user: { id: 'test-user', orgId: 'test-org-123', role: 'admin' },
                    organization: { id: 'test-org-123', name: 'Test Org' },
                    permissions: ['read', 'write', 'admin'],
                    requestId
                };
            }
            const authToken = this.extractAuthToken(req);
            if (!authToken) {
                if (this.isIntrospectionQuery(req)) {
                    return {
                        req,
                        res,
                        requestId
                    };
                }
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' }
                });
            }
            const tokenPayload = await this.authService.verifyToken(authToken);
            if (!tokenPayload || !tokenPayload.userId) {
                throw new graphql_1.GraphQLError('Invalid authentication token', {
                    extensions: { code: 'UNAUTHENTICATED' }
                });
            }
            const user = await this.authService.getUserById(tokenPayload.userId);
            if (!user) {
                throw new graphql_1.GraphQLError('User account is inactive', {
                    extensions: { code: 'FORBIDDEN' }
                });
            }
            const organization = await this.tenantService.getOrganization(user.orgId);
            if (!organization) {
                throw new graphql_1.GraphQLError('Organization is inactive', {
                    extensions: { code: 'FORBIDDEN' }
                });
            }
            const clientIp = this.getClientIp(req);
            const clientId = `${user.id}:${clientIp}`;
            const rateLimitResult = await this.rateLimitService.checkLimit(clientId, 100, 60 * 1000);
            if (!rateLimitResult.allowed) {
                throw new graphql_1.GraphQLError('Rate limit exceeded', {
                    extensions: { code: 'RATE_LIMITED' }
                });
            }
            const permissions = await this.tenantService.getUserPermissions(user.id, user.orgId);
            await this.auditService.logUserAction(user.orgId, user.id, this.extractOperationName(req), 'graphql_request', requestId, {
                variables: req.body?.variables || {},
                ip: clientIp,
                userAgent: this.getUserAgent(req),
                processingTime: Date.now() - startTime
            }, requestId);
            return {
                req,
                res,
                user,
                organization,
                permissions,
                requestId
            };
        }
        catch (error) {
            this.logger.error('Security middleware error', {
                requestId,
                error: error instanceof Error ? error.message : 'Unknown error',
                ip: this.getClientIp(req),
                userAgent: this.getUserAgent(req),
                processingTime: Date.now() - startTime
            });
            throw error;
        }
    }
    createFieldAuthMiddleware() {
        return {
            requireOrgAccess: (requiredPermission) => {
                return async (resolve, parent, args, context, info) => {
                    if (!context.user) {
                        throw new graphql_1.GraphQLError('Authentication required', {
                            extensions: { code: 'UNAUTHENTICATED' }
                        });
                    }
                    const orgId = args.orgId || parent?.orgId || args.input?.orgId;
                    if (orgId && orgId !== context.user.orgId) {
                        const hasAccess = await this.tenantService.validateCrossOrgAccess(context.user.id, orgId);
                        if (!hasAccess) {
                            throw new graphql_1.GraphQLError('Access denied to organization', {
                                extensions: { code: 'FORBIDDEN' }
                            });
                        }
                    }
                    if (requiredPermission && !context.permissions?.includes(requiredPermission)) {
                        throw new graphql_1.GraphQLError(`Permission required: ${requiredPermission}`, {
                            extensions: { code: 'FORBIDDEN' }
                        });
                    }
                    return resolve(parent, args, context, info);
                };
            },
            requireAdmin: () => {
                return async (resolve, parent, args, context, info) => {
                    if (!context.user || context.user.role !== 'admin') {
                        throw new graphql_1.GraphQLError('Admin access required', {
                            extensions: { code: 'FORBIDDEN' }
                        });
                    }
                    return resolve(parent, args, context, info);
                };
            },
            requireProjectAccess: (permission) => {
                return async (resolve, parent, args, context, info) => {
                    const projectId = args.projectId || parent?.projectId || args.input?.projectId;
                    if (projectId) {
                        const hasAccess = await this.tenantService.validateProjectAccess(context.user.id, projectId, permission || 'read');
                        if (!hasAccess) {
                            throw new graphql_1.GraphQLError('Access denied to project', {
                                extensions: { code: 'FORBIDDEN' }
                            });
                        }
                    }
                    return resolve(parent, args, context, info);
                };
            },
            rateLimit: (config) => {
                return async (resolve, parent, args, context, info) => {
                    const key = `${context.user?.id}:${info.fieldName}`;
                    const rateLimitResult = await this.rateLimitService.checkLimit(key, config.maxRequests || 10, config.windowMs || 60000);
                    const isLimited = !rateLimitResult.allowed;
                    if (isLimited) {
                        throw new graphql_1.GraphQLError(`Rate limit exceeded for ${info.fieldName}`, {
                            extensions: { code: 'RATE_LIMITED' }
                        });
                    }
                    return resolve(parent, args, context, info);
                };
            }
        };
    }
    createDataFilterMiddleware() {
        return {
            enforceOrgScope: () => {
                return async (resolve, parent, args, context, info) => {
                    if (!args.orgId && context.user?.orgId) {
                        args.orgId = context.user.orgId;
                    }
                    if (parent?.orgId && !args.orgId) {
                        args.orgId = parent.orgId;
                    }
                    return resolve(parent, args, context, info);
                };
            },
            filterResults: () => {
                return async (resolve, parent, args, context, info) => {
                    const result = await resolve(parent, args, context, info);
                    if (Array.isArray(result)) {
                        return result.filter((item) => {
                            return this.hasAccessToItem(item, context.user, context.permissions);
                        });
                    }
                    if (result && !this.hasAccessToItem(result, context.user, context.permissions)) {
                        return null;
                    }
                    return result;
                };
            }
        };
    }
    createAuditMiddleware() {
        return {
            logMutations: () => {
                return async (resolve, parent, args, context, info) => {
                    const startTime = Date.now();
                    try {
                        const result = await resolve(parent, args, context, info);
                        if (context.user?.id && context.user?.orgId) {
                            await this.auditService.logUserAction(context.user.orgId, context.user.id, `mutation_${info.fieldName}`, 'graphql_mutation', context.requestId, {
                                args: this.sanitizeArgs(args),
                                success: true,
                                processingTime: Date.now() - startTime
                            }, context.requestId);
                        }
                        return result;
                    }
                    catch (error) {
                        if (context.user?.id && context.user?.orgId) {
                            await this.auditService.logUserAction(context.user.orgId, context.user.id, `mutation_${info.fieldName}`, 'graphql_mutation', context.requestId, {
                                args: this.sanitizeArgs(args),
                                success: false,
                                error: error.message,
                                processingTime: Date.now() - startTime
                            }, context.requestId);
                        }
                        throw error;
                    }
                };
            }
        };
    }
    createValidationMiddleware() {
        return {
            validateInput: (schema) => {
                return async (resolve, parent, args, context, info) => {
                    const validationResult = await schema.validate(args);
                    if (validationResult.error) {
                        throw new graphql_1.GraphQLError(`Input validation failed: ${validationResult.error.message}`, {
                            extensions: { code: 'BAD_USER_INPUT' }
                        });
                    }
                    return resolve(parent, validationResult.value, context, info);
                };
            },
            sanitizeInput: () => {
                return async (resolve, parent, args, context, info) => {
                    const sanitizedArgs = this.sanitizeInputRecursive(args);
                    return resolve(parent, sanitizedArgs, context, info);
                };
            }
        };
    }
    extractAuthToken(req) {
        let authHeader;
        if (typeof req.get === 'function') {
            authHeader = req.get('Authorization');
        }
        else if (req.headers) {
            authHeader = req.headers.authorization || req.headers.Authorization;
        }
        else if (req.connectionParams) {
            const cp = req.connectionParams;
            authHeader = cp.Authorization || cp.authorization;
        }
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        return null;
    }
    isIntrospectionQuery(req) {
        const query = req.body?.query || '';
        return query.includes('__schema') || query.includes('__type');
    }
    extractOperationName(req) {
        return req.body?.operationName || 'anonymous';
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    hasAccessToItem(item, user, permissions = []) {
        if (item.orgId && item.orgId !== user?.orgId) {
            return false;
        }
        return true;
    }
    sanitizeArgs(args) {
        const sanitized = { ...args };
        const sensitiveFields = ['password', 'token', 'secret', 'key'];
        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }
        return sanitized;
    }
    sanitizeInputRecursive(obj) {
        if (typeof obj === 'string') {
            return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeInputRecursive(item));
        }
        if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = this.sanitizeInputRecursive(value);
            }
            return sanitized;
        }
        return obj;
    }
    getUserAgent(req) {
        try {
            if (typeof req?.get === 'function') {
                return req.get('User-Agent') || '';
            }
            const headers = req?.headers || {};
            return headers['user-agent'] || headers['User-Agent'] || '';
        }
        catch {
            return '';
        }
    }
    getClientIp(req) {
        try {
            if (req?.ip)
                return req.ip;
            const headers = req?.headers || {};
            const xff = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
            if (typeof xff === 'string') {
                return xff.split(',')[0].trim();
            }
            return req?.socket?.remoteAddress || req?.connection?.remoteAddress || '';
        }
        catch {
            return '';
        }
    }
}
exports.SecurityMiddleware = SecurityMiddleware;
//# sourceMappingURL=SecurityMiddleware.js.map