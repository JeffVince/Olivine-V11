"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
class RateLimitService {
    constructor(redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}/0`) {
        const isTestMode = process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'test';
        this.redis = isTestMode ? null : new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        });
    }
    async checkLimit(key, limit, windowMs) {
        if (!this.redis) {
            const now = Date.now();
            return { allowed: true, count: 0, resetTime: now + windowMs };
        }
        const now = Date.now();
        const windowStart = now - windowMs;
        const redisKey = `rate_limit:${key}`;
        await this.redis
            .multi()
            .zremrangebyscore(redisKey, 0, windowStart)
            .zadd(redisKey, now, now)
            .expire(redisKey, Math.ceil(windowMs / 1000))
            .exec();
        const count = await this.redis.zcard(redisKey);
        const resetTime = now + windowMs;
        return {
            allowed: count <= limit,
            count,
            resetTime
        };
    }
    async applyRateLimit(identifier, endpoint, limit = 100, windowMs = 60000) {
        const key = `${identifier}:${endpoint}`;
        const result = await this.checkLimit(key, limit, windowMs);
        return {
            ...result,
            retryAfter: result.allowed ? undefined : Math.ceil((result.resetTime - Date.now()) / 1000)
        };
    }
    async getStatus(key, windowMs) {
        const now = Date.now();
        const windowStart = now - windowMs;
        const redisKey = `rate_limit:${key}`;
        if (!this.redis)
            return 0;
        await this.redis.zremrangebyscore(redisKey, 0, windowStart);
        return await this.redis.zcard(redisKey);
    }
    async reset(key) {
        const redisKey = `rate_limit:${key}`;
        if (!this.redis)
            return;
        await this.redis.del(redisKey);
    }
    async close() {
        if (!this.redis)
            return;
        await this.redis.quit();
    }
}
exports.RateLimitService = RateLimitService;
//# sourceMappingURL=RateLimitService.js.map