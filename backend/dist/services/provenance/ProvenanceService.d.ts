import { Neo4jService } from '../Neo4jService';
import { CryptoService } from '../crypto/CryptoService';
export interface CommitInput extends Record<string, unknown> {
    orgId: string;
    message: string;
    author: string;
    authorType: 'user' | 'agent' | 'system';
    parentCommitId?: string;
    branchName?: string;
    metadata?: Record<string, any>;
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
    duration_ms?: number;
    metadata?: Record<string, any>;
}
export interface EntityUpdate {
    entity_id: string;
    entity_type: string;
    new_properties: Record<string, any>;
    changes?: Record<string, any>;
}
export interface EntityVersion {
    id: string;
    entity_id: string;
    entity_type: string;
    props: Record<string, any>;
    valid_from: Date;
    valid_to?: Date;
    tx_time: Date;
    created_by_commit: string;
    org_id: string;
    metadata?: Record<string, any>;
}
export interface EdgeFact {
    id: string;
    type: string;
    from_id: string;
    to_id: string;
    from_type?: string;
    to_type?: string;
    valid_from: Date;
    valid_to?: Date;
    created_by_commit: string;
    ended_by_commit?: string;
    org_id: string;
    props?: Record<string, any>;
    metadata?: Record<string, any>;
}
export interface Branch {
    name: string;
    org_id: string;
    project_id?: string;
    description: string;
    created_from_commit?: string;
    head_commit?: string;
    status: 'active' | 'merged' | 'abandoned';
    created_by: string;
    created_at: Date;
    merged_at?: Date;
    merged_by?: string;
    metadata?: Record<string, any>;
}
export interface ProvenanceResult {
    commit_id: string;
    success: boolean;
    entities_updated: number;
    versions_created?: number;
    edge_facts_created?: number;
}
export declare class ProvenanceService {
    private readonly neo4j;
    private readonly crypto;
    constructor(neo4j?: Neo4jService, crypto?: CryptoService);
    executeWithProvenance(operation: string, entity_updates: EntityUpdate[], user_id: string, commit_message: string, tool_name: string, org_id: string): Promise<ProvenanceResult>;
    private applyEntityUpdate;
    createEdgeFact(type: string, from_id: string, to_id: string, org_id: string, user_id: string, props?: Record<string, any>, from_type?: string, to_type?: string): Promise<string>;
    endEdgeFact(edge_fact_id: string, org_id: string, user_id: string): Promise<void>;
    getEntityAtTime(entity_id: string, timestamp: Date, org_id: string): Promise<Record<string, any> | null>;
    getEntityHistory(entity_id: string, entity_type: string, org_id: string): Promise<EntityVersion[]>;
    createBranch(name: string, org_id: string, project_id: string | null, description: string, user_id: string, from_commit?: string): Promise<Branch>;
    private generateId;
    createCommit(input: CommitInput): Promise<string>;
    createAction(commitId: string, input: ActionInput, orgId: string): Promise<void>;
}
//# sourceMappingURL=ProvenanceService.d.ts.map