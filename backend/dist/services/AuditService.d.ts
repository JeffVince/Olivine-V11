export interface AuditLogEntry {
    id?: string;
    tenantId: string;
    actorType: 'user' | 'agent' | 'system';
    actorId?: string;
    action: string;
    targetType?: string;
    targetId?: string;
    requestId?: string;
    payload?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    timestamp?: Date;
}
export declare class AuditService {
    private postgresService;
    constructor();
    log(entry: AuditLogEntry): Promise<void>;
    logUserAction(tenantId: string, userId: string, action: string, targetType?: string, targetId?: string, payload?: Record<string, any>, requestId?: string): Promise<void>;
    logAgentAction(tenantId: string, agentId: string, action: string, targetType?: string, targetId?: string, payload?: Record<string, any>): Promise<void>;
    logSystemAction(tenantId: string, action: string, targetType?: string, targetId?: string, payload?: Record<string, any>): Promise<void>;
    getAuditLogs(tenantId: string, filters?: {
        actorType?: string;
        actorId?: string;
        action?: string;
        targetType?: string;
        targetId?: string;
        startDate?: Date;
        endDate?: Date;
    }, limit?: number, offset?: number): Promise<AuditLogEntry[]>;
    close(): Promise<void>;
}
//# sourceMappingURL=AuditService.d.ts.map