import { pubsub as globalPubsub } from '../../services/graphql/PubSub';

export class OntologySubscriptions {
  private pubsub: typeof globalPubsub;

  constructor() {
    this.pubsub = globalPubsub;
  }

  getSubscriptions() {
    return {
      // File classification updates
      fileClassified: {
        subscribe: (_: unknown, { orgId, projectId }: { orgId: string; projectId?: string }) => {
          const channel = projectId 
            ? `FILE_CLASSIFIED_${orgId}_${projectId}`
            : `FILE_CLASSIFIED_${orgId}`;
          return this.pubsub.asyncIterator(channel);
        },
        resolve: (payload: any) => payload
      },

      // Content ontology updates
      sceneCreated: {
        subscribe: (_: unknown, { orgId, projectId }: { orgId: string; projectId: string }) => {
          const channel = `SCENE_CREATED_${orgId}_${projectId}`;
          return this.pubsub.asyncIterator(channel);
        },
        resolve: (payload: any) => payload
      },

      characterCreated: {
        subscribe: (_: unknown, { orgId, projectId }: { orgId: string; projectId: string }) => {
          const channel = `CHARACTER_CREATED_${orgId}_${projectId}`;
          return this.pubsub.asyncIterator(channel);
        },
        resolve: (payload: any) => payload
      },

      // Operations ontology updates
      purchaseOrderCreated: {
        subscribe: (_: unknown, { orgId, projectId }: { orgId: string; projectId?: string }) => {
          const channel = projectId 
            ? `PURCHASE_ORDER_CREATED_${orgId}_${projectId}`
            : `PURCHASE_ORDER_CREATED_${orgId}`;
          return this.pubsub.asyncIterator(channel);
        },
        resolve: (payload: any) => payload
      },

      budgetUpdated: {
        subscribe: (_: unknown, { orgId, projectId }: { orgId: string; projectId: string }) => {
          const channel = `BUDGET_UPDATED_${orgId}_${projectId}`;
          return this.pubsub.asyncIterator(channel);
        },
        resolve: (payload: any) => payload
      },

      // Agent processing updates
      agentTaskCompleted: {
        subscribe: (_: unknown, { orgId, agentType }: { orgId: string; agentType?: string }) => {
          const channel = agentType 
            ? `AGENT_TASK_COMPLETED_${orgId}_${agentType}`
            : `AGENT_TASK_COMPLETED_${orgId}`;
          return this.pubsub.asyncIterator(channel);
        },
        resolve: (payload: any) => payload
      },

      workflowExecuted: {
        subscribe: (_: unknown, { orgId, workflowId }: { orgId: string; workflowId?: string }) => {
          const channel = workflowId 
            ? `WORKFLOW_EXECUTED_${orgId}_${workflowId}`
            : `WORKFLOW_EXECUTED_${orgId}`;
          return this.pubsub.asyncIterator(channel);
        },
        resolve: (payload: any) => payload
      },

      // Novelty detection alerts
      noveltyDetected: {
        subscribe: (_: unknown, { orgId, alertLevel }: { orgId: string; alertLevel?: string }) => {
          const channel = alertLevel 
            ? `NOVELTY_DETECTED_${orgId}_${alertLevel}`
            : `NOVELTY_DETECTED_${orgId}`;
          return this.pubsub.asyncIterator(channel);
        },
        resolve: (payload: any) => payload
      },

      // Provenance updates
      commitCreated: {
        subscribe: (_: unknown, { orgId, projectId, branchName }: { orgId: string; projectId?: string; branchName?: string }) => {
          let channel = `COMMIT_CREATED_${orgId}`;
          if (projectId) channel += `_${projectId}`;
          if (branchName) channel += `_${branchName}`;
          return this.pubsub.asyncIterator(channel);
        },
        resolve: (payload: any) => payload
      },

      entityVersionCreated: {
        subscribe: (_: unknown, { orgId, entityType }: { orgId: string; entityType?: string }) => {
          const channel = entityType 
            ? `ENTITY_VERSION_CREATED_${orgId}_${entityType}`
            : `ENTITY_VERSION_CREATED_${orgId}`;
          return this.pubsub.asyncIterator(channel);
        },
        resolve: (payload: any) => payload
      },

      // System health and monitoring
      systemAlert: {
        subscribe: (_: unknown, { orgId, severity }: { orgId: string; severity?: string }) => {
          const channel = severity 
            ? `SYSTEM_ALERT_${orgId}_${severity}`
            : `SYSTEM_ALERT_${orgId}`;
          return this.pubsub.asyncIterator(channel);
        },
        resolve: (payload: any) => payload
      },

      // Data sync status
      syncProgress: {
        subscribe: (_: unknown, { orgId, sourceId }: { orgId: string; sourceId?: string }) => {
          const channel = sourceId 
            ? `SYNC_PROGRESS_${orgId}_${sourceId}`
            : `SYNC_PROGRESS_${orgId}`;
          return this.pubsub.asyncIterator(channel);
        },
        resolve: (payload: any) => payload
      }
    };
  }

  // Publisher methods for services to use

  async publishFileClassified(orgId: string, projectId: string | null, fileData: any): Promise<void> {
    const channels = [`FILE_CLASSIFIED_${orgId}`];
    if (projectId) {
      channels.push(`FILE_CLASSIFIED_${orgId}_${projectId}`);
    }

    for (const channel of channels) {
      await this.pubsub.publish(channel, {
        fileClassified: fileData
      });
    }
  }

  async publishSceneCreated(orgId: string, projectId: string, sceneData: any): Promise<void> {
    await this.pubsub.publish(`SCENE_CREATED_${orgId}_${projectId}`, {
      sceneCreated: sceneData
    });
  }

  async publishCharacterCreated(orgId: string, projectId: string, characterData: any): Promise<void> {
    await this.pubsub.publish(`CHARACTER_CREATED_${orgId}_${projectId}`, {
      characterCreated: characterData
    });
  }

  async publishPurchaseOrderCreated(orgId: string, projectId: string | null, poData: any): Promise<void> {
    const channels = [`PURCHASE_ORDER_CREATED_${orgId}`];
    if (projectId) {
      channels.push(`PURCHASE_ORDER_CREATED_${orgId}_${projectId}`);
    }

    for (const channel of channels) {
      await this.pubsub.publish(channel, {
        purchaseOrderCreated: poData
      });
    }
  }

  async publishBudgetUpdated(orgId: string, projectId: string, budgetData: any): Promise<void> {
    await this.pubsub.publish(`BUDGET_UPDATED_${orgId}_${projectId}`, {
      budgetUpdated: budgetData
    });
  }

  async publishAgentTaskCompleted(orgId: string, agentType: string, taskData: any): Promise<void> {
    const channels = [`AGENT_TASK_COMPLETED_${orgId}`, `AGENT_TASK_COMPLETED_${orgId}_${agentType}`];

    for (const channel of channels) {
      await this.pubsub.publish(channel, {
        agentTaskCompleted: taskData
      });
    }
  }

  async publishWorkflowExecuted(orgId: string, workflowId: string, workflowData: any): Promise<void> {
    const channels = [`WORKFLOW_EXECUTED_${orgId}`, `WORKFLOW_EXECUTED_${orgId}_${workflowId}`];

    for (const channel of channels) {
      await this.pubsub.publish(channel, {
        workflowExecuted: workflowData
      });
    }
  }

  async publishNoveltyDetected(orgId: string, alertLevel: string, noveltyData: any): Promise<void> {
    const channels = [`NOVELTY_DETECTED_${orgId}`, `NOVELTY_DETECTED_${orgId}_${alertLevel}`];

    for (const channel of channels) {
      await this.pubsub.publish(channel, {
        noveltyDetected: noveltyData
      });
    }
  }

  async publishCommitCreated(
    orgId: string, 
    projectId: string | null, 
    branchName: string, 
    commitData: any
  ): Promise<void> {
    let baseChannel = `COMMIT_CREATED_${orgId}`;
    const channels = [baseChannel];
    
    if (projectId) {
      channels.push(`${baseChannel}_${projectId}`);
      if (branchName) {
        channels.push(`${baseChannel}_${projectId}_${branchName}`);
      }
    }

    for (const channel of channels) {
      await this.pubsub.publish(channel, {
        commitCreated: commitData
      });
    }
  }

  async publishEntityVersionCreated(orgId: string, entityType: string, versionData: any): Promise<void> {
    const channels = [`ENTITY_VERSION_CREATED_${orgId}`, `ENTITY_VERSION_CREATED_${orgId}_${entityType}`];

    for (const channel of channels) {
      await this.pubsub.publish(channel, {
        entityVersionCreated: versionData
      });
    }
  }

  async publishSystemAlert(orgId: string, severity: string, alertData: any): Promise<void> {
    const channels = [`SYSTEM_ALERT_${orgId}`, `SYSTEM_ALERT_${orgId}_${severity}`];

    for (const channel of channels) {
      await this.pubsub.publish(channel, {
        systemAlert: alertData
      });
    }
  }

  async publishSyncProgress(orgId: string, sourceId: string | null, progressData: any): Promise<void> {
    const channels = [`SYNC_PROGRESS_${orgId}`];
    if (sourceId) {
      channels.push(`SYNC_PROGRESS_${orgId}_${sourceId}`);
    }

    for (const channel of channels) {
      await this.pubsub.publish(channel, {
        syncProgress: progressData
      });
    }
  }
}

export const ontologySubscriptions = new OntologySubscriptions();
