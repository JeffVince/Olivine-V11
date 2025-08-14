import { Neo4jService } from '../../../services/Neo4jService';
import { PostgresService } from '../../../services/PostgresService';
import { Classifier } from '../classification/Classifier';
import { FileMetadata } from '../types';
export declare class ClusterService {
    private neo4j;
    private postgres;
    private classifier;
    constructor(neo4j: Neo4jService, postgres: PostgresService, classifier: Classifier);
    createContentCluster(orgId: string, fileId: string): Promise<string>;
    performMultiSlotClassification(orgId: string, fileId: string, resourcePath: string, fileMetadata: FileMetadata): Promise<string[]>;
}
//# sourceMappingURL=ClusterService.d.ts.map