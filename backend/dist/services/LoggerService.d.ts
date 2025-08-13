type Meta = unknown;
export interface CentralLogger {
    info(message: string, meta?: Meta): void;
    warn(message: string, meta?: Meta): void;
    error(message: string, meta?: Meta): void;
    debug(message: string, meta?: Meta): void;
}
export declare function createServiceLogger(serviceName: string): CentralLogger;
export {};
//# sourceMappingURL=LoggerService.d.ts.map