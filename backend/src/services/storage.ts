import { PostgresService } from './PostgresService';

const postgres = new PostgresService();

/**
 * Retrieve specific metadata fields for a source.
 */
export async function getSourceMetadata(
  orgId: string,
  sourceId: string,
  type: string,
  fields: string[]
): Promise<Record<string, any> | null> {
  const projections = fields
    .map((field) => `metadata->>'${field}' as ${field}`)
    .join(',\n               ');
  const query = `
    SELECT ${projections}
    FROM sources
    WHERE orgId = $1 AND id = $2 AND type = $3
  `;
  const result = await postgres.executeQuery(query, [orgId, sourceId, type]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

/**
 * Merge metadata into a source record.
 */
export async function updateSourceMetadata(
  orgId: string,
  sourceId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const query = `
    UPDATE sources
    SET metadata = metadata || $1::jsonb,
        updated_at = NOW()
    WHERE orgId = $2 AND id = $3
  `;
  await postgres.executeQuery(query, [JSON.stringify(metadata), orgId, sourceId]);
}
