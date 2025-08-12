"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const PostgresService_1 = require("./PostgresService");
class AuditService {
    constructor() {
        this.postgresService = new PostgresService_1.PostgresService();
    }
    async log(entry) {
        try {
            const query = `
        INSERT INTO audit_log (
          tenant_id, actor_type, actor_id, action, 
          target_type, target_id, request_id, payload, 
          ip_address, user_agent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;
            const values = [
                entry.tenantId,
                entry.actorType,
                entry.actorId,
                entry.action,
                entry.targetType,
                entry.targetId,
                entry.requestId,
                entry.payload ? JSON.stringify(entry.payload) : null,
                entry.ipAddress,
                entry.userAgent,
                entry.timestamp || new Date()
            ];
            await this.postgresService.executeQuery(query, values);
        }
        catch (error) {
            console.error('Error logging audit event:', error);
        }
    }
    async logUserAction(tenantId, userId, action, targetType, targetId, payload, requestId) {
        await this.log({
            tenantId,
            actorType: 'user',
            actorId: userId,
            action,
            targetType,
            targetId,
            payload,
            requestId
        });
    }
    async logAgentAction(tenantId, agentId, action, targetType, targetId, payload) {
        await this.log({
            tenantId,
            actorType: 'agent',
            actorId: agentId,
            action,
            targetType,
            targetId,
            payload
        });
    }
    async logSystemAction(tenantId, action, targetType, targetId, payload) {
        await this.log({
            tenantId,
            actorType: 'system',
            action,
            targetType,
            targetId,
            payload
        });
    }
    async getAuditLogs(tenantId, filters, limit = 100, offset = 0) {
        try {
            let query = 'SELECT * FROM audit_log WHERE tenant_id = $1';
            const values = [tenantId];
            let paramCount = 1;
            if (filters) {
                if (filters.actorType) {
                    query += ` AND actor_type = $${++paramCount}`;
                    values.push(filters.actorType);
                }
                if (filters.actorId) {
                    query += ` AND actor_id = $${++paramCount}`;
                    values.push(filters.actorId);
                }
                if (filters.action) {
                    query += ` AND action = $${++paramCount}`;
                    values.push(filters.action);
                }
                if (filters.targetType) {
                    query += ` AND target_type = $${++paramCount}`;
                    values.push(filters.targetType);
                }
                if (filters.targetId) {
                    query += ` AND target_id = $${++paramCount}`;
                    values.push(filters.targetId);
                }
                if (filters.startDate) {
                    query += ` AND created_at >= $${++paramCount}`;
                    values.push(filters.startDate);
                }
                if (filters.endDate) {
                    query += ` AND created_at <= $${++paramCount}`;
                    values.push(filters.endDate);
                }
            }
            query += ' ORDER BY created_at DESC';
            query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
            values.push(limit, offset);
            const result = await this.postgresService.executeQuery(query, values);
            return result.rows.map(row => ({
                id: row.id,
                tenantId: row.tenant_id,
                actorType: row.actor_type,
                actorId: row.actor_id,
                action: row.action,
                targetType: row.target_type,
                targetId: row.target_id,
                requestId: row.request_id,
                payload: row.payload ? JSON.parse(row.payload) : undefined,
                ipAddress: row.ip_address,
                userAgent: row.user_agent,
                timestamp: row.created_at
            }));
        }
        catch (error) {
            console.error('Error fetching audit logs:', error);
            return [];
        }
    }
    async close() {
        await this.postgresService.close();
    }
}
exports.AuditService = AuditService;
//# sourceMappingURL=AuditService.js.map