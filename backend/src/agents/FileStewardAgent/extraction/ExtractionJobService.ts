import { PostgresService } from '../../../services/PostgresService'
import { QueueService } from '../../../services/queues/QueueService'
import { v4 as uuidv4 } from 'uuid'

export class ExtractionJobService {
  private postgres: PostgresService
  private queues: QueueService

  constructor(postgres: PostgresService, queues: QueueService) {
    this.postgres = postgres
    this.queues = queues
  }

  async queueExtractionJobs(orgId: string, fileId: string, slots: string[], fileMetadata: { mimeType: string }): Promise<boolean> {
    let jobsQueued = false
    for (const slot of slots) {
      const parsers = await this.getApplicableParsers(orgId, slot, fileMetadata.mimeType)
      for (const parser of parsers) {
        const jobId = uuidv4()
        await this.postgres.query(`
          INSERT INTO extraction_job (id, org_id, file_id, parser_name, parser_version, status, created_at)
          VALUES ($1, $2, $3, $4, $5, 'queued', NOW())
        `, [jobId, orgId, fileId, parser.parser_name, parser.parser_version])
        await this.queues.addJob('content-extraction', 'extract-content', {
          jobId,
          orgId,
          fileId,
          slot,
          parser: parser.parser_name,
          parserVersion: parser.parser_version,
          metadata: fileMetadata
        })
        jobsQueued = true
      }
    }
    return jobsQueued
  }

  private async getApplicableParsers(orgId: string, slot: string, mimeType: string): Promise<any[]> {
    const result = await this.postgres.query(`
      SELECT * FROM parser_registry 
      WHERE org_id = $1 
      AND slot = $2 
      AND (mime_type = $3 OR mime_type = '*/*')
      AND enabled = true
      ORDER BY parser_version DESC
    `, [orgId, slot, mimeType])
    return result.rows
  }
}


