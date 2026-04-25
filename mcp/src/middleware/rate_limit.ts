import { ok, err } from "@llm-seo-lab/shared";
import type { Result } from "@llm-seo-lab/shared";
import { errQuota } from "../errors.ts";
import type { RateLimiter } from "../types.ts";

export interface TokenBucketOpts {
  capacity: number;
  refillPerMinute: number;
  now?: () => number;
}

export class TokenBucket implements RateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefillMs: number }>();
  private readonly capacity: number;
  private readonly refillRate: number;
  private readonly now: () => number;

  constructor(opts: TokenBucketOpts) {
    this.capacity = opts.capacity;
    this.refillRate = opts.refillPerMinute / 60_000;
    this.now = opts.now ?? Date.now;
  }

  async take(key: string, n = 1): Promise<Result<void>> {
    const t = this.now();
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: this.capacity, lastRefillMs: t };
      this.buckets.set(key, b);
    }
    const elapsed = t - b.lastRefillMs;
    b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refillRate);
    b.lastRefillMs = t;
    if (b.tokens < n) {
      const deficit = n - b.tokens;
      const waitSec = Math.ceil(deficit / this.refillRate / 1000);
      return err(errQuota(waitSec));
    }
    b.tokens -= n;
    return ok(undefined);
  }

  inspect(key: string): number | undefined {
    return this.buckets.get(key)?.tokens;
  }
}
