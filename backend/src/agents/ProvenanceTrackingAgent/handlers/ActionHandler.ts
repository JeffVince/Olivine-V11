import { v4 as uuidv4 } from 'uuid'
import { ActionRepository } from '../graph/ActionRepository'
import { CommitRepository } from '../graph/CommitRepository'
import { ActionInput } from '../types'

export class ActionHandler {
  private actions: ActionRepository
  private commits: CommitRepository

  constructor(actionRepository: ActionRepository, commitRepository: CommitRepository) {
    this.actions = actionRepository
    this.commits = commitRepository
  }

  async createAction(actionData: { commitId: string; orgId: string; action: ActionInput }): Promise<string> {
    const { commitId, orgId, action } = actionData
    const actionId = uuidv4()
    const createdAt = new Date().toISOString()
    await this.actions.createAction({ actionId, commitId, actionType: action.actionType, tool: action.tool, entityType: action.entityType, entityId: action.entityId, inputs: JSON.stringify(action.inputs), outputs: JSON.stringify(action.outputs), status: action.status, errorMessage: action.errorMessage || null, createdAt })
    await this.commits.addCommitActionRelationship(commitId, actionId, orgId)
    return actionId
  }
}


