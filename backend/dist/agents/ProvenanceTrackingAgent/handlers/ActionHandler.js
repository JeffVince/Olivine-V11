"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionHandler = void 0;
const uuid_1 = require("uuid");
class ActionHandler {
    constructor(actionRepository, commitRepository) {
        this.actions = actionRepository;
        this.commits = commitRepository;
    }
    async createAction(actionData) {
        const { commitId, orgId, action } = actionData;
        const actionId = (0, uuid_1.v4)();
        const createdAt = new Date().toISOString();
        await this.actions.createAction({ actionId, commitId, actionType: action.actionType, tool: action.tool, entityType: action.entityType, entityId: action.entityId, inputs: JSON.stringify(action.inputs), outputs: JSON.stringify(action.outputs), status: action.status, errorMessage: action.errorMessage || null, createdAt });
        await this.commits.addCommitActionRelationship(commitId, actionId, orgId);
        return actionId;
    }
}
exports.ActionHandler = ActionHandler;
//# sourceMappingURL=ActionHandler.js.map