import "server-only";

// ponytail: in-memory fixed-window limiter — resets on deploy, per-instance only.
// Ceiling: multi-instance/serverless deploys need a shared store (e.g. Upstash
// Redis) behind the same check() signature.

type Window = { count: number; resetAt: number };
const buckets = new Map<string, Window>();
const MAX_BUCKETS = 10_000;

/** True if `key` is still under `limit` hits per `windowMs`; counts the hit. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const win = buckets.get(key);
  if (!win || win.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      // Cheap sweep instead of an interval timer.
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_BUCKETS) buckets.clear(); // memory guard beats accuracy
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  win.count++;
  return win.count <= limit;
}
