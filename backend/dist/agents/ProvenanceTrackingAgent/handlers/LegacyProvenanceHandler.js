"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegacyProvenanceHandler = void 0;
class LegacyProvenanceHandler {
    constructor(commitHandler, actionHandler) {
        this.commits = commitHandler;
        this.actions = actionHandler;
    }
    async process(provenanceData) {
        const { orgId, message, author, authorType, actions } = provenanceData;
        const commitId = await this.commits.createCommit({ orgId, message, author, authorType, branchName: 'main' });
        if (Array.isArray(actions)) {
            for (const action of actions) {
                await this.actions.createAction({ commitId, orgId, action });
            }
        }
        return { commitId };
    }
}
exports.LegacyProvenanceHandler = LegacyProvenanceHandler;
//# sourceMappingURL=LegacyProvenanceHandler.js.map