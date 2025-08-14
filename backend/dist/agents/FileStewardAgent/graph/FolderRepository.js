"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FolderRepository = void 0;
class FolderRepository {
    constructor(neo4jService) {
        this.neo4j = neo4jService;
    }
    async upsertFolderNode(orgId, sourceId, path, name) {
        const query = `
      MERGE (f:Folder {org_id: $orgId, source_id: $sourceId, path: $path})
      ON CREATE SET 
        f.id = randomUUID(),
        f.created_at = datetime()
      SET 
        f.name = $name,
        f.updated_at = datetime(),
        f.current = true,
        f.deleted = false
      RETURN f.id as folderId
    `;
        const result = await this.neo4j.run(query, { orgId, sourceId, path, name });
        return result.records[0].get('folderId');
    }
}
exports.FolderRepository = FolderRepository;
//# sourceMappingURL=FolderRepository.js.map