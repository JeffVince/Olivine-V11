// Simple in-memory store for runbooks for now; replace with Postgres per plan
export interface Runbook {
  id: string
  orgId: string
  name: string
  description?: string
  spec: any
  createdAt: string
  updatedAt: string
}

import { PostgresService } from '../PostgresService'

export class RunbookService {
  // TODO: Implementation Plan - 06-Agent-System-Implementation.md - Runbook service implementation
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend runbook service tests
  private readonly pg = new PostgresService()

  async list(orgId: string): Promise<Runbook[]> {
    const res = await this.pg.executeQuery(
      `SELECT id, org_id as "orgId", name, description, spec, created_at as "createdAt", updated_at as "updatedAt" FROM runbooks WHERE org_id = $1 ORDER BY updated_at DESC`,
      [orgId],
    )
    return res.rows
  }

  async save(input: Omit<Runbook, 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Runbook> {
    const res = await this.pg.executeQuery(
      `
      INSERT INTO runbooks (id, org_id, name, description, spec, created_at, updated_at)
      VALUES (coalesce($1, gen_random_uuid())::uuid, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        spec = EXCLUDED.spec,
        updated_at = NOW()
      RETURNING id, org_id as "orgId", name, description, spec, created_at as "createdAt", updated_at as "updatedAt"
      `,
      [input.id || null, input.orgId, input.name, input.description || null, input.spec],
    )
    return res.rows[0]
  }
}


