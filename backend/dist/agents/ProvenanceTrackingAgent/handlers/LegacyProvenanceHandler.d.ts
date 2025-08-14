import { CommitHandler } from './CommitHandler';
import { ActionHandler } from './ActionHandler';
export declare class LegacyProvenanceHandler {
    private commits;
    private actions;
    constructor(commitHandler: CommitHandler, actionHandler: ActionHandler);
    process(provenanceData: any): Promise<{
        commitId: string;
    }>;
}
//# sourceMappingURL=LegacyProvenanceHandler.d.ts.map