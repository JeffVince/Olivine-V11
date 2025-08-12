import { BaseAgent, AgentConfig } from './BaseAgent';
import { QueueService } from '../services/queues/QueueService';
export interface CommitInput {
    orgId: string;
    message: string;
    author: string;
    authorType: 'user' | 'agent' | 'system';
    parentCommitId?: string;
    branchName?: string;
    metadata?: any;
}
export interface ActionInput {
    actionType: string;
    tool: string;
    entityType: string;
    entityId: string;
    inputs: any;
    outputs: any;
    status: 'success' | 'failed' | 'pending';
    errorMessage?: string;
}
export interface VersionInput {
    orgId: string;
    entityId: string;
    entityType: string;
    properties: any;
    commitId: string;
}
export declare class ProvenanceTrackingAgent extends BaseAgent {
    private provenanceService;
    private neo4jService;
    private cryptoService;
    constructor(queueService: QueueService, config?: Partial<AgentConfig>);
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onPause(): Promise<void>;
    protected onResume(): Promise<void>;
    processCreateCommit(commitData: CommitInput): Promise<string>;
    processCreateAction(actionData: {
        commitId: string;
        orgId: string;
        action: ActionInput;
    }): Promise<string>;
    processCreateVersion(versionData: VersionInput): Promise<string>;
    processProvenance(provenanceData: any): Promise<any>;
    validateCommit(commitId: string): Promise<boolean>;
    getCommitHistory(orgId: string, branchName: string, limit?: number): Promise<any[]>;
    getEntityVersionHistory(orgId: string, entityId: string): Promise<any[]>;
    private getExistingVersion;
    private createCommitParentRelationship;
    private createCommitActionRelationship;
    private createEntityVersionRelationship;
}
//# sourceMappingURL=ProvenanceTrackingAgent.d.ts.map