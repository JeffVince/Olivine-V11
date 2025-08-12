export declare class OntologySubscriptions {
    private pubsub;
    constructor();
    getSubscriptions(): {
        fileClassified: {
            subscribe: (_: unknown, { orgId, projectId }: {
                orgId: string;
                projectId?: string;
            }) => AsyncIterator<unknown, any, any>;
            resolve: (payload: any) => any;
        };
        sceneCreated: {
            subscribe: (_: unknown, { orgId, projectId }: {
                orgId: string;
                projectId: string;
            }) => AsyncIterator<unknown, any, any>;
            resolve: (payload: any) => any;
        };
        characterCreated: {
            subscribe: (_: unknown, { orgId, projectId }: {
                orgId: string;
                projectId: string;
            }) => AsyncIterator<unknown, any, any>;
            resolve: (payload: any) => any;
        };
        purchaseOrderCreated: {
            subscribe: (_: unknown, { orgId, projectId }: {
                orgId: string;
                projectId?: string;
            }) => AsyncIterator<unknown, any, any>;
            resolve: (payload: any) => any;
        };
        budgetUpdated: {
            subscribe: (_: unknown, { orgId, projectId }: {
                orgId: string;
                projectId: string;
            }) => AsyncIterator<unknown, any, any>;
            resolve: (payload: any) => any;
        };
        agentTaskCompleted: {
            subscribe: (_: unknown, { orgId, agentType }: {
                orgId: string;
                agentType?: string;
            }) => AsyncIterator<unknown, any, any>;
            resolve: (payload: any) => any;
        };
        workflowExecuted: {
            subscribe: (_: unknown, { orgId, workflowId }: {
                orgId: string;
                workflowId?: string;
            }) => AsyncIterator<unknown, any, any>;
            resolve: (payload: any) => any;
        };
        noveltyDetected: {
            subscribe: (_: unknown, { orgId, alertLevel }: {
                orgId: string;
                alertLevel?: string;
            }) => AsyncIterator<unknown, any, any>;
            resolve: (payload: any) => any;
        };
        commitCreated: {
            subscribe: (_: unknown, { orgId, projectId, branchName }: {
                orgId: string;
                projectId?: string;
                branchName?: string;
            }) => AsyncIterator<unknown, any, any>;
            resolve: (payload: any) => any;
        };
        entityVersionCreated: {
            subscribe: (_: unknown, { orgId, entityType }: {
                orgId: string;
                entityType?: string;
            }) => AsyncIterator<unknown, any, any>;
            resolve: (payload: any) => any;
        };
        systemAlert: {
            subscribe: (_: unknown, { orgId, severity }: {
                orgId: string;
                severity?: string;
            }) => AsyncIterator<unknown, any, any>;
            resolve: (payload: any) => any;
        };
        syncProgress: {
            subscribe: (_: unknown, { orgId, sourceId }: {
                orgId: string;
                sourceId?: string;
            }) => AsyncIterator<unknown, any, any>;
            resolve: (payload: any) => any;
        };
    };
    publishFileClassified(orgId: string, projectId: string | null, fileData: any): Promise<void>;
    publishSceneCreated(orgId: string, projectId: string, sceneData: any): Promise<void>;
    publishCharacterCreated(orgId: string, projectId: string, characterData: any): Promise<void>;
    publishPurchaseOrderCreated(orgId: string, projectId: string | null, poData: any): Promise<void>;
    publishBudgetUpdated(orgId: string, projectId: string, budgetData: any): Promise<void>;
    publishAgentTaskCompleted(orgId: string, agentType: string, taskData: any): Promise<void>;
    publishWorkflowExecuted(orgId: string, workflowId: string, workflowData: any): Promise<void>;
    publishNoveltyDetected(orgId: string, alertLevel: string, noveltyData: any): Promise<void>;
    publishCommitCreated(orgId: string, projectId: string | null, branchName: string, commitData: any): Promise<void>;
    publishEntityVersionCreated(orgId: string, entityType: string, versionData: any): Promise<void>;
    publishSystemAlert(orgId: string, severity: string, alertData: any): Promise<void>;
    publishSyncProgress(orgId: string, sourceId: string | null, progressData: any): Promise<void>;
}
export declare const ontologySubscriptions: OntologySubscriptions;
//# sourceMappingURL=OntologySubscriptions.d.ts.map