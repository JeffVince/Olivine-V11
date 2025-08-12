import { Redis } from 'ioredis';

export class RateLimitService {
  private redis: Redis;

  constructor(redisUrl: string = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}/0`) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  /**
   * Check if a rate limit is exceeded for a given key
   * @param key Unique identifier (e.g., user ID, IP address)
   * @param limit Maximum number of requests allowed
   * @param windowMs Time window in milliseconds
   * @returns Object with allowed status and current count
   */
  async checkLimit(key: string, limit: number, windowMs: number): Promise<{
    allowed: boolean;
    count: number;
    resetTime: number;
  }> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `rate_limit:${key}`;

    // Clean up old entries and add current request
    await this.redis
      .multi()
      .zremrangebyscore(redisKey, 0, windowStart)
      .zadd(redisKey, now, now)
      .expire(redisKey, Math.ceil(windowMs / 1000))
      .exec();

    // Count current requests in window
    const count = await this.redis.zcard(redisKey);
    const resetTime = now + windowMs;

    return {
      allowed: count <= limit,
      count,
      resetTime
    };
  }

  /**
   * Apply a rate limit for API endpoints
   * @param identifier User ID or IP address
   * @param endpoint Endpoint being accessed
   * @param limit Request limit
   * @param windowMs Time window in milliseconds
   * @returns Rate limit status
   */
  async applyRateLimit(
    identifier: string,
    endpoint: string,
    limit: number = 100,
    windowMs: number = 60000 // 1 minute
  ): Promise<{
    allowed: boolean;
    count: number;
    resetTime: number;
    retryAfter?: number;
  }> {
    const key = `${identifier}:${endpoint}`;
    const result = await this.checkLimit(key, limit, windowMs);

    return {
      ...result,
      retryAfter: result.allowed ? undefined : Math.ceil((result.resetTime - Date.now()) / 1000)
    };
  }

  /**
   * Get current rate limit status without incrementing
   * @param key Unique identifier
   * @param windowMs Time window in milliseconds
   * @returns Current count in window
   */
  async getStatus(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `rate_limit:${key}`;

    // Clean up and count
    await this.redis.zremrangebyscore(redisKey, 0, windowStart);
    return await this.redis.zcard(redisKey);
  }

  /**
   * Reset rate limit for a key
   * @param key Unique identifier
   */
  async reset(key: string): Promise<void> {
    const redisKey = `rate_limit:${key}`;
    await this.redis.del(redisKey);
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
