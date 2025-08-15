import { QuotaInfo } from '../sdk/client';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RateLimiter {
  private remaining = Infinity;
  private resetTime = 0; // epoch ms

  async wait(): Promise<void> {
    const now = Date.now();
    if (this.remaining <= 0 && now < this.resetTime) {
      await sleep(this.resetTime - now);
      // after waiting for reset we assume quota refreshed
      this.remaining = Infinity;
    }
    if (this.remaining !== Infinity) {
      this.remaining -= 1;
    }
  }

  update(quota?: QuotaInfo, retryAfter?: number): void {
    if (retryAfter !== undefined) {
      this.remaining = 0;
      this.resetTime = Date.now() + retryAfter;
      return;
    }
    if (quota?.remaining !== undefined) {
      this.remaining = quota.remaining;
    }
    if (quota?.reset !== undefined) {
      this.resetTime = quota.reset;
    }
  }
}

