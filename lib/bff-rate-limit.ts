interface TokenBucketSnapshot {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
}

class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;

  constructor(
    private readonly capacity: number,
    private readonly windowMs: number,
  ) {
    this.tokens = capacity;
    this.lastRefillMs = Date.now();
  }

  consume(cost = 1): TokenBucketSnapshot {
    const now = Date.now();
    this.refill(now);

    if (this.tokens < cost) {
      return {
        allowed: false,
        limit: this.capacity,
        remaining: 0,
        resetAtMs: this.lastRefillMs + this.windowMs,
      };
    }

    this.tokens -= cost;
    return {
      allowed: true,
      limit: this.capacity,
      remaining: Math.max(0, Math.floor(this.tokens)),
      resetAtMs: this.lastRefillMs + this.windowMs,
    };
  }

  private refill(now: number): void {
    const elapsed = now - this.lastRefillMs;
    if (elapsed < this.windowMs) {
      return;
    }

    const windowsElapsed = Math.floor(elapsed / this.windowMs);
    this.lastRefillMs += windowsElapsed * this.windowMs;
    this.tokens = this.capacity;
  }
}

class TokenBucketStore {
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(
    private readonly capacity: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string, cost = 1): TokenBucketSnapshot {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(this.capacity, this.windowMs);
      this.buckets.set(key, bucket);
    }

    return bucket.consume(cost);
  }
}

const WINDOW_MS = 60_000;

export interface BffRateLimitConfig {
  enabled: boolean;
  limitPerMinute: number;
}

let rateLimitStore: TokenBucketStore | null = null;
let rateLimitConfig: BffRateLimitConfig | null = null;

export function configureBffRateLimit(config: BffRateLimitConfig): void {
  rateLimitConfig = config;
  rateLimitStore = new TokenBucketStore(config.limitPerMinute, WINDOW_MS);
}

export function resetBffRateLimitForTests(): void {
  rateLimitStore = null;
  rateLimitConfig = null;
}

export interface BffRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
}

export function checkBffRateLimit(clientKey: string): BffRateLimitResult | null {
  if (!rateLimitConfig?.enabled || !rateLimitStore) {
    return null;
  }

  const snapshot = rateLimitStore.consume(clientKey);
  return {
    allowed: snapshot.allowed,
    limit: snapshot.limit,
    remaining: snapshot.remaining,
    resetAtMs: snapshot.resetAtMs,
  };
}

export function resolveBffClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return `ip:${first}`;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return `ip:${realIp}`;
  }

  return "ip:local";
}

export function applyBffRateLimitHeaders(
  headers: Headers,
  result: BffRateLimitResult,
): void {
  headers.set("RateLimit-Limit", String(result.limit));
  headers.set("RateLimit-Remaining", String(Math.max(0, result.remaining)));
  headers.set("RateLimit-Reset", String(Math.ceil(result.resetAtMs / 1000)));

  if (!result.allowed) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((result.resetAtMs - Date.now()) / 1000),
    );
    headers.set("Retry-After", String(retryAfterSeconds));
  }
}
