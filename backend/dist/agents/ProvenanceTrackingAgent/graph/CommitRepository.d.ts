import { Neo4jService } from '../../../services/Neo4jService';
export interface CommitRecord {
    id: string;
    orgId: string;
    message: string;
    author: string;
    authorType: string;
    createdAt: any;
    parentCommitId: string | null;
    branchName: string;
    signature: string;
    metadata: any;
}
export declare class CommitRepository {
    private neo4j;
    constructor(neo4jService: Neo4jService);
    createCommit(params: {
        commitId: string;
        orgId: string;
        message: string;
        author: string;
        authorType: string;
        createdAt: string;
        parentCommitId: string | null;
        branchName: string;
        signature: string;
        metadataJson: string;
    }): Promise<string>;
    addParentRelationship(parentCommitId: string, childCommitId: string, orgId: string): Promise<void>;
    addCommitActionRelationship(commitId: string, actionId: string, orgId: string): Promise<void>;
    getCommitById(commitId: string): Promise<CommitRecord | null>;
    getCommitHistory(orgId: string, branchName: string, limit?: number): Promise<any[]>;
}
//# sourceMappingURL=CommitRepository.d.ts.map