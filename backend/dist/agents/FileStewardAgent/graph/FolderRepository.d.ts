import { Neo4jService } from '../../../services/Neo4jService';
export declare class FolderRepository {
    private neo4j;
    constructor(neo4jService: Neo4jService);
    upsertFolderNode(orgId: string, sourceId: string, path: string, name: string): Promise<string>;
}
//# sourceMappingURL=FolderRepository.d.ts.map