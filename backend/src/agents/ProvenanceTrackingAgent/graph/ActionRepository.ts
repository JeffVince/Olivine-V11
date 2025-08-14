import { Neo4jService } from '../../../services/Neo4jService'

export class ActionRepository {
  private neo4j: Neo4jService

  constructor(neo4jService: Neo4jService) {
    this.neo4j = neo4jService
  }

  async createAction(params: {
    actionId: string
    commitId: string
    actionType: string
    tool: string
    entityType: string
    entityId: string
    inputs: string
    outputs: string
    status: string
    errorMessage: string | null
    createdAt: string
  }): Promise<string> {
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
    `
    await this.neo4j.run(query, params)
    return params.actionId
  }
}


