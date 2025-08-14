import { BaseAgent, AgentConfig } from '../BaseAgent';
import { QueueService } from '../../services/queues/QueueService';
import { CommitInput, ActionInput, VersionInput } from './types';
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
export * from './types';
//# sourceMappingURL=index.d.ts.map