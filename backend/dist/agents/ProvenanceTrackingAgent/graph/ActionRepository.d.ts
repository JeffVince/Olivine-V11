import { Neo4jService } from '../../../services/Neo4jService';
export declare class ActionRepository {
    private neo4j;
    constructor(neo4jService: Neo4jService);
    createAction(params: {
        actionId: string;
        commitId: string;
        actionType: string;
        tool: string;
        entityType: string;
        entityId: string;
        inputs: string;
        outputs: string;
        status: string;
        errorMessage: string | null;
        createdAt: string;
    }): Promise<string>;
}
//# sourceMappingURL=ActionRepository.d.ts.map