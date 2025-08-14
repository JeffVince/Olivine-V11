import { CryptoService } from '../../../services/crypto/CryptoService';
import { CommitRepository } from '../graph/CommitRepository';
import { CommitInput } from '../types';
export declare class CommitHandler {
    private crypto;
    private commits;
    constructor(cryptoService: CryptoService, commitRepository: CommitRepository);
    createCommit(commitData: CommitInput): Promise<string>;
    validateCommit(commitId: string): Promise<boolean>;
}
//# sourceMappingURL=CommitHandler.d.ts.map