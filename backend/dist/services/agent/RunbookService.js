"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunbookService = void 0;
const PostgresService_1 = require("../PostgresService");
class RunbookService {
    constructor() {
        this.pg = new PostgresService_1.PostgresService();
    }
    async list(orgId) {
        const res = await this.pg.executeQuery(`SELECT id, org_id as "orgId", name, description, spec, created_at as "createdAt", updated_at as "updatedAt" FROM runbooks WHERE org_id = $1 ORDER BY updated_at DESC`, [orgId]);
        return res.rows;
    }
    async save(input) {
        const res = await this.pg.executeQuery(`
      INSERT INTO runbooks (id, org_id, name, description, spec, created_at, updated_at)
      VALUES (coalesce($1, gen_random_uuid())::uuid, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        spec = EXCLUDED.spec,
        updated_at = NOW()
      RETURNING id, org_id as "orgId", name, description, spec, created_at as "createdAt", updated_at as "updatedAt"
      `, [input.id || null, input.orgId, input.name, input.description || null, input.spec]);
        return res.rows[0];
    }
}
exports.RunbookService = RunbookService;
//# sourceMappingURL=RunbookService.js.map