import { PostgresService } from './PostgresService';

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

export class AuditService {
  private postgresService: PostgresService;

  constructor() {
    this.postgresService = new PostgresService();
  }

  /**
   * Log an audit event
   * @param entry Audit log entry
   */
  async log(entry: AuditLogEntry): Promise<void> {
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
    } catch (error) {
      console.error('Error logging audit event:', error);
      // Don't throw - audit logging shouldn't break the main flow
    }
  }

  /**
   * Log user action
   * @param tenantId Tenant ID
   * @param userId User ID
   * @param action Action performed
   * @param targetType Type of target (e.g., 'project', 'file')
   * @param targetId ID of target
   * @param payload Additional data
   * @param requestId Request ID for tracing
   */
  async logUserAction(
    tenantId: string,
    userId: string,
    action: string,
    targetType?: string,
    targetId?: string,
    payload?: Record<string, any>,
    requestId?: string
  ): Promise<void> {
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

  /**
   * Log agent action
   * @param tenantId Tenant ID
   * @param agentId Agent identifier
   * @param action Action performed
   * @param targetType Type of target
   * @param targetId ID of target
   * @param payload Additional data
   */
  async logAgentAction(
    tenantId: string,
    agentId: string,
    action: string,
    targetType?: string,
    targetId?: string,
    payload?: Record<string, any>
  ): Promise<void> {
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

  /**
   * Log system action
   * @param tenantId Tenant ID
   * @param action Action performed
   * @param targetType Type of target
   * @param targetId ID of target
   * @param payload Additional data
   */
  async logSystemAction(
    tenantId: string,
    action: string,
    targetType?: string,
    targetId?: string,
    payload?: Record<string, any>
  ): Promise<void> {
    await this.log({
      tenantId,
      actorType: 'system',
      action,
      targetType,
      targetId,
      payload
    });
  }

  /**
   * Get audit logs for a tenant
   * @param tenantId Tenant ID
   * @param filters Optional filters
   * @param limit Maximum number of records
   * @param offset Offset for pagination
   * @returns Array of audit log entries
   */
  async getAuditLogs(
    tenantId: string,
    filters?: {
      actorType?: string;
      actorId?: string;
      action?: string;
      targetType?: string;
      targetId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    try {
      let query = 'SELECT * FROM audit_log WHERE tenant_id = $1';
      const values: any[] = [tenantId];
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
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    await this.postgresService.close();
  }
}
