import { Neo4jService } from '../Neo4jService';
import { CryptoService } from '../crypto/CryptoService';
export interface CommitInput {
    orgId: string;
    message: string;
    author: string;
    authorType: 'user' | 'agent' | 'system';
    parentCommitId?: string;
    branchName?: string;
}
export interface ActionInput {
    actionType: string;
    tool: string;
    entityType: string;
    entityId: string;
    inputs?: any;
    outputs?: any;
    status: 'success' | 'failed';
    errorMessage?: string;
}
export declare class ProvenanceService {
    private readonly neo4j;
    private readonly crypto;
    constructor(neo4j?: Neo4jService, crypto?: CryptoService);
    createCommit(input: CommitInput): Promise<string>;
    createAction(commitId: string, input: ActionInput, orgId: string): Promise<void>;
}
//# sourceMappingURL=ProvenanceService.d.ts.map