export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Per-instance fallback. On Vercel each instance has its own memory, so this only limits loosely. */
export function checkMemoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowMs };
    buckets.set(key, next);
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: next.resetAt };
  }
  current.count += 1;
  return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}

/**
 * Fixed-window rate limit shared across all instances via Upstash Redis (REST API, works in the
 * edge middleware). Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable it.
 * Without them, or if Redis is unreachable, it falls back to the per-instance limiter (fail-open).
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const redisKey = `rl:${key}`;
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([
          ['INCR', redisKey],
          ['PEXPIRE', redisKey, String(windowMs), 'NX'],
          ['PTTL', redisKey],
        ]),
        cache: 'no-store',
      });
      if (res.ok) {
        const [incr, , ttl] = (await res.json()) as Array<{ result: number }>;
        const count = Number(incr?.result);
        if (Number.isFinite(count)) {
          return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt: Date.now() + Math.max(0, Number(ttl?.result) || windowMs) };
        }
      }
    } catch (error) {
      console.error('Rate limit store unavailable, using per-instance limiter', error);
    }
  }
  return checkMemoryRateLimit(key, limit, windowMs);
}

export function clientIp(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
}
