import { CommitHandler } from './CommitHandler'
import { ActionHandler } from './ActionHandler'

export class LegacyProvenanceHandler {
  private commits: CommitHandler
  private actions: ActionHandler

  constructor(commitHandler: CommitHandler, actionHandler: ActionHandler) {
    this.commits = commitHandler
    this.actions = actionHandler
  }

  async process(provenanceData: any): Promise<{ commitId: string }> {
    const { orgId, message, author, authorType, actions } = provenanceData
    const commitId = await this.commits.createCommit({ orgId, message, author, authorType, branchName: 'main' })
    if (Array.isArray(actions)) {
      for (const action of actions) {
        await this.actions.createAction({ commitId, orgId, action })
      }
    }
    return { commitId }
  }
}


