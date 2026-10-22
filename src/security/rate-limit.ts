export interface RateLimitResult { allowed: boolean; remaining: number; retryAfterMs: number }

export class MemoryRateLimiter {
  private buckets = new Map<string, { count: number; reset: number }>();
  private readonly max: number;
  private readonly windowMs: number;

  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const old = this.buckets.get(key);
    if (!old || old.reset <= now) {
      this.buckets.set(key, { count: 1, reset: now + this.windowMs });
      return { allowed: true, remaining: this.max - 1, retryAfterMs: 0 };
    }
    if (old.count >= this.max) return { allowed: false, remaining: 0, retryAfterMs: old.reset - now };
    old.count++;
    return { allowed: true, remaining: this.max - old.count, retryAfterMs: 0 };
  }
}
