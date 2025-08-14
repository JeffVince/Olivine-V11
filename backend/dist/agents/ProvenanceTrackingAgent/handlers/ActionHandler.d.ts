import { ActionRepository } from '../graph/ActionRepository';
import { CommitRepository } from '../graph/CommitRepository';
import { ActionInput } from '../types';
export declare class ActionHandler {
    private actions;
    private commits;
    constructor(actionRepository: ActionRepository, commitRepository: CommitRepository);
    createAction(actionData: {
        commitId: string;
        orgId: string;
        action: ActionInput;
    }): Promise<string>;
}
//# sourceMappingURL=ActionHandler.d.ts.map