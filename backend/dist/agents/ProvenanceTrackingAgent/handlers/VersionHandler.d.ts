import { CryptoService } from '../../../services/crypto/CryptoService';
import { VersionRepository } from '../graph/VersionRepository';
import { VersionInput } from '../types';
export declare class VersionHandler {
    private crypto;
    private versions;
    constructor(cryptoService: CryptoService, versionRepository: VersionRepository);
    createVersion(versionData: VersionInput): Promise<string>;
}
//# sourceMappingURL=VersionHandler.d.ts.map