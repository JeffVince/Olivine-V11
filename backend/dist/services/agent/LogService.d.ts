export interface LogEntry {
    jobId: string;
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
}
export declare class LogService {
    appendLog(entry: LogEntry): Promise<void>;
}
//# sourceMappingURL=LogService.d.ts.map