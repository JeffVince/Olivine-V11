"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtractionJobService = void 0;
const uuid_1 = require("uuid");
class ExtractionJobService {
    constructor(postgres, queues) {
        this.postgres = postgres;
        this.queues = queues;
    }
    async queueExtractionJobs(orgId, fileId, slots, fileMetadata) {
        let jobsQueued = false;
        for (const slot of slots) {
            const parsers = await this.getApplicableParsers(orgId, slot, fileMetadata.mimeType);
            for (const parser of parsers) {
                const jobId = (0, uuid_1.v4)();
                await this.postgres.query(`
          INSERT INTO extraction_job (id, org_id, file_id, parser_name, parser_version, status, created_at)
          VALUES ($1, $2, $3, $4, $5, 'queued', NOW())
        `, [jobId, orgId, fileId, parser.parser_name, parser.parser_version]);
                await this.queues.addJob('content-extraction', 'extract-content', {
                    jobId,
                    orgId,
                    fileId,
                    slot,
                    parser: parser.parser_name,
                    parserVersion: parser.parser_version,
                    metadata: fileMetadata
                });
                jobsQueued = true;
            }
        }
        return jobsQueued;
    }
    async getApplicableParsers(orgId, slot, mimeType) {
        const result = await this.postgres.query(`
      SELECT * FROM parser_registry 
      WHERE org_id = $1 
      AND slot = $2 
      AND (mime_type = $3 OR mime_type = '*/*')
      AND enabled = true
      ORDER BY parser_version DESC
    `, [orgId, slot, mimeType]);
        return result.rows;
    }
}
exports.ExtractionJobService = ExtractionJobService;
//# sourceMappingURL=ExtractionJobService.js.map