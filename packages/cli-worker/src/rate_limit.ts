import type { RateLimits, Tier } from "@llm-seo-lab/shared";
import { DEFAULT_RATE_LIMITS_BY_TIER, err, ok } from "@llm-seo-lab/shared";
import type { Result } from "@llm-seo-lab/shared";

/**
 * Per-(site, action) token bucket. Refill rate is taken from the SiteConfig
 * tier so that quota policy is read off configuration, not hard-coded here.
 *
 * `take` returns an envelope; on QUOTA_EXCEEDED it includes retry_after_seconds
 * so callers (the runner, the WebSocket subscriber list, the dashboard) can
 * surface a user-actionable message instead of failing silently.
 */
export class TierRateLimiter {
  private readonly buckets = new Map<string, { tokens: number; last: number }>();
  private readonly capacityFn: (tier: Tier, action: keyof RateLimits) => number;
  private readonly nowFn: () => number;

  constructor(opts?: {
    capacities?: Record<Tier, RateLimits>;
    now?: () => number;
  }) {
    const caps = opts?.capacities ?? DEFAULT_RATE_LIMITS_BY_TIER;
    this.capacityFn = (tier, action) => caps[tier][action];
    this.nowFn = opts?.now ?? Date.now;
  }

  take(input: { site_id: string; tier: Tier; action: keyof RateLimits; n?: number }): Result<void> {
    const key = `${input.site_id}:${input.action}`;
    const cap = this.capacityFn(input.tier, input.action);
    if (cap <= 0) {
      return err({
        code: "QUOTA_EXCEEDED",
        message: `tier ${input.tier} has zero quota for ${input.action}`,
        retry_after_seconds: 60,
        actionable_next_step: "Upgrade tier or wait for the operator to lift the cap.",
      });
    }
    const refillPerMs = cap / 60_000;
    const now = this.nowFn();
    const bucket = this.buckets.get(key) ?? { tokens: cap, last: now };
    const elapsed = now - bucket.last;
    bucket.tokens = Math.min(cap, bucket.tokens + elapsed * refillPerMs);
    bucket.last = now;
    const need = input.n ?? 1;
    if (bucket.tokens < need) {
      const deficit = need - bucket.tokens;
      const wait = Math.ceil(deficit / refillPerMs / 1000);
      this.buckets.set(key, bucket);
      return err({
        code: "QUOTA_EXCEEDED",
        message: `rate limit hit for ${key} (cap ${cap}/min)`,
        retry_after_seconds: wait,
        actionable_next_step: `Wait ${wait}s or raise the ${input.action} cap for tier ${input.tier}.`,
      });
    }
    bucket.tokens -= need;
    this.buckets.set(key, bucket);
    return ok(undefined);
  }

  /**
   * Inspect remaining tokens for a (site, action). Used by /health and the
   * dashboard to render available headroom without consuming tokens.
   */
  inspect(site_id: string, action: keyof RateLimits): { tokens: number; cap_per_minute: number } | undefined {
    const key = `${site_id}:${action}`;
    const b = this.buckets.get(key);
    if (!b) return undefined;
    return { tokens: b.tokens, cap_per_minute: NaN };
  }
}
