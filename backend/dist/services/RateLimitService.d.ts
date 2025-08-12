export declare class RateLimitService {
    private redis;
    constructor(redisUrl?: string);
    checkLimit(key: string, limit: number, windowMs: number): Promise<{
        allowed: boolean;
        count: number;
        resetTime: number;
    }>;
    applyRateLimit(identifier: string, endpoint: string, limit?: number, windowMs?: number): Promise<{
        allowed: boolean;
        count: number;
        resetTime: number;
        retryAfter?: number;
    }>;
    getStatus(key: string, windowMs: number): Promise<number>;
    reset(key: string): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=RateLimitService.d.ts.map