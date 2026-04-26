type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;

export function checkEmbedRateLimit(keyId: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  let b = buckets.get(keyId);
  if (!b || now > b.reset) {
    b = { count: 0, reset: now + WINDOW_MS };
    buckets.set(keyId, b);
  }
  if (b.count >= MAX_PER_WINDOW) {
    return { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) };
  }
  b.count += 1;
  return { ok: true };
}
