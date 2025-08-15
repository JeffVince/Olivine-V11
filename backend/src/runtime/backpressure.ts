import { RateLimiter } from './rateLimiter';
import { QuotaError, RequestResult } from '../sdk/client';

type Job<T> = () => Promise<RequestResult<T>>;

export class Backpressure {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private limiter: RateLimiter) {}

  run<T>(job: Job<T>): Promise<RequestResult<T>> {
    const execute = async (): Promise<RequestResult<T>> => {
      // Repeat until the job succeeds without rate limit error
      while (true) {
        await this.limiter.wait();
        try {
          const result = await job();
          this.limiter.update(result.quota, result.retryAfter);
          return result;
        } catch (err) {
          if (err instanceof QuotaError) {
            this.limiter.update(err.quota, err.retryAfter);
            continue; // wait and retry
          }
          throw err;
        }
      }
    };
    const next = this.queue.then(execute);
    // ensure subsequent jobs wait for this one
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }
}

