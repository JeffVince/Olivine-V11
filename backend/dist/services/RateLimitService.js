"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitService = void 0;
const ioredis_1 = require("ioredis");
class RateLimitService {
    constructor(redisUrl = 'redis://localhost:6379') {
        this.redis = new ioredis_1.Redis(redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        });
    }
    async checkLimit(key, limit, windowMs) {
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
        await this.redis.zremrangebyscore(redisKey, 0, windowStart);
        return await this.redis.zcard(redisKey);
    }
    async reset(key) {
        const redisKey = `rate_limit:${key}`;
        await this.redis.del(redisKey);
    }
    async close() {
        await this.redis.quit();
    }
}
exports.RateLimitService = RateLimitService;
//# sourceMappingURL=RateLimitService.js.map