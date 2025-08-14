"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionRepository = void 0;
class ActionRepository {
    constructor(neo4jService) {
        this.neo4j = neo4jService;
    }
    async createAction(params) {
        const query = `
      CREATE (a:Action {
        id: $actionId,
        commit_id: $commitId,
        action_type: $actionType,
        tool: $tool,
        entity_type: $entityType,
        entity_id: $entityId,
        inputs: $inputs,
        outputs: $outputs,
        status: $status,
        error_message: $errorMessage,
        created_at: datetime($createdAt)
      })
      RETURN a.id as actionId
    `;
        await this.neo4j.run(query, params);
        return params.actionId;
    }
}
exports.ActionRepository = ActionRepository;
//# sourceMappingURL=ActionRepository.js.map