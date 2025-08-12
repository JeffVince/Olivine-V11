"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ontologySubscriptions = exports.OntologySubscriptions = void 0;
const PubSub_1 = require("../../services/graphql/PubSub");
class OntologySubscriptions {
    constructor() {
        this.pubsub = PubSub_1.pubsub;
    }
    getSubscriptions() {
        return {
            fileClassified: {
                subscribe: (_, { orgId, projectId }) => {
                    const channel = projectId
                        ? `FILE_CLASSIFIED_${orgId}_${projectId}`
                        : `FILE_CLASSIFIED_${orgId}`;
                    return this.pubsub.asyncIterator(channel);
                },
                resolve: (payload) => payload
            },
            sceneCreated: {
                subscribe: (_, { orgId, projectId }) => {
                    const channel = `SCENE_CREATED_${orgId}_${projectId}`;
                    return this.pubsub.asyncIterator(channel);
                },
                resolve: (payload) => payload
            },
            characterCreated: {
                subscribe: (_, { orgId, projectId }) => {
                    const channel = `CHARACTER_CREATED_${orgId}_${projectId}`;
                    return this.pubsub.asyncIterator(channel);
                },
                resolve: (payload) => payload
            },
            purchaseOrderCreated: {
                subscribe: (_, { orgId, projectId }) => {
                    const channel = projectId
                        ? `PURCHASE_ORDER_CREATED_${orgId}_${projectId}`
                        : `PURCHASE_ORDER_CREATED_${orgId}`;
                    return this.pubsub.asyncIterator(channel);
                },
                resolve: (payload) => payload
            },
            budgetUpdated: {
                subscribe: (_, { orgId, projectId }) => {
                    const channel = `BUDGET_UPDATED_${orgId}_${projectId}`;
                    return this.pubsub.asyncIterator(channel);
                },
                resolve: (payload) => payload
            },
            agentTaskCompleted: {
                subscribe: (_, { orgId, agentType }) => {
                    const channel = agentType
                        ? `AGENT_TASK_COMPLETED_${orgId}_${agentType}`
                        : `AGENT_TASK_COMPLETED_${orgId}`;
                    return this.pubsub.asyncIterator(channel);
                },
                resolve: (payload) => payload
            },
            workflowExecuted: {
                subscribe: (_, { orgId, workflowId }) => {
                    const channel = workflowId
                        ? `WORKFLOW_EXECUTED_${orgId}_${workflowId}`
                        : `WORKFLOW_EXECUTED_${orgId}`;
                    return this.pubsub.asyncIterator(channel);
                },
                resolve: (payload) => payload
            },
            noveltyDetected: {
                subscribe: (_, { orgId, alertLevel }) => {
                    const channel = alertLevel
                        ? `NOVELTY_DETECTED_${orgId}_${alertLevel}`
                        : `NOVELTY_DETECTED_${orgId}`;
                    return this.pubsub.asyncIterator(channel);
                },
                resolve: (payload) => payload
            },
            commitCreated: {
                subscribe: (_, { orgId, projectId, branchName }) => {
                    let channel = `COMMIT_CREATED_${orgId}`;
                    if (projectId)
                        channel += `_${projectId}`;
                    if (branchName)
                        channel += `_${branchName}`;
                    return this.pubsub.asyncIterator(channel);
                },
                resolve: (payload) => payload
            },
            entityVersionCreated: {
                subscribe: (_, { orgId, entityType }) => {
                    const channel = entityType
                        ? `ENTITY_VERSION_CREATED_${orgId}_${entityType}`
                        : `ENTITY_VERSION_CREATED_${orgId}`;
                    return this.pubsub.asyncIterator(channel);
                },
                resolve: (payload) => payload
            },
            systemAlert: {
                subscribe: (_, { orgId, severity }) => {
                    const channel = severity
                        ? `SYSTEM_ALERT_${orgId}_${severity}`
                        : `SYSTEM_ALERT_${orgId}`;
                    return this.pubsub.asyncIterator(channel);
                },
                resolve: (payload) => payload
            },
            syncProgress: {
                subscribe: (_, { orgId, sourceId }) => {
                    const channel = sourceId
                        ? `SYNC_PROGRESS_${orgId}_${sourceId}`
                        : `SYNC_PROGRESS_${orgId}`;
                    return this.pubsub.asyncIterator(channel);
                },
                resolve: (payload) => payload
            }
        };
    }
    async publishFileClassified(orgId, projectId, fileData) {
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
    async publishSceneCreated(orgId, projectId, sceneData) {
        await this.pubsub.publish(`SCENE_CREATED_${orgId}_${projectId}`, {
            sceneCreated: sceneData
        });
    }
    async publishCharacterCreated(orgId, projectId, characterData) {
        await this.pubsub.publish(`CHARACTER_CREATED_${orgId}_${projectId}`, {
            characterCreated: characterData
        });
    }
    async publishPurchaseOrderCreated(orgId, projectId, poData) {
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
    async publishBudgetUpdated(orgId, projectId, budgetData) {
        await this.pubsub.publish(`BUDGET_UPDATED_${orgId}_${projectId}`, {
            budgetUpdated: budgetData
        });
    }
    async publishAgentTaskCompleted(orgId, agentType, taskData) {
        const channels = [`AGENT_TASK_COMPLETED_${orgId}`, `AGENT_TASK_COMPLETED_${orgId}_${agentType}`];
        for (const channel of channels) {
            await this.pubsub.publish(channel, {
                agentTaskCompleted: taskData
            });
        }
    }
    async publishWorkflowExecuted(orgId, workflowId, workflowData) {
        const channels = [`WORKFLOW_EXECUTED_${orgId}`, `WORKFLOW_EXECUTED_${orgId}_${workflowId}`];
        for (const channel of channels) {
            await this.pubsub.publish(channel, {
                workflowExecuted: workflowData
            });
        }
    }
    async publishNoveltyDetected(orgId, alertLevel, noveltyData) {
        const channels = [`NOVELTY_DETECTED_${orgId}`, `NOVELTY_DETECTED_${orgId}_${alertLevel}`];
        for (const channel of channels) {
            await this.pubsub.publish(channel, {
                noveltyDetected: noveltyData
            });
        }
    }
    async publishCommitCreated(orgId, projectId, branchName, commitData) {
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
    async publishEntityVersionCreated(orgId, entityType, versionData) {
        const channels = [`ENTITY_VERSION_CREATED_${orgId}`, `ENTITY_VERSION_CREATED_${orgId}_${entityType}`];
        for (const channel of channels) {
            await this.pubsub.publish(channel, {
                entityVersionCreated: versionData
            });
        }
    }
    async publishSystemAlert(orgId, severity, alertData) {
        const channels = [`SYSTEM_ALERT_${orgId}`, `SYSTEM_ALERT_${orgId}_${severity}`];
        for (const channel of channels) {
            await this.pubsub.publish(channel, {
                systemAlert: alertData
            });
        }
    }
    async publishSyncProgress(orgId, sourceId, progressData) {
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
exports.OntologySubscriptions = OntologySubscriptions;
exports.ontologySubscriptions = new OntologySubscriptions();
//# sourceMappingURL=OntologySubscriptions.js.map