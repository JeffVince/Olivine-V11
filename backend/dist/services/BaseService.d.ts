import { CentralLogger } from './LoggerService';
export interface Logger {
    info(message: string, meta?: unknown): void;
    warn(message: string, meta?: unknown): void;
    error(message: string, meta?: unknown): void;
    debug(message: string, meta?: unknown): void;
}
export declare class BaseService {
    readonly serviceName: string;
    protected readonly logger: CentralLogger;
    constructor(serviceName: string);
}
//# sourceMappingURL=BaseService.d.ts.map