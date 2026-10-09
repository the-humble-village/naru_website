import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

/**
 * Fixed-window login rate limiting, in memory, no dependency.
 *
 * Two buckets, both required:
 *  - per (IP, login): 5 failures. Charged only on a 401, so someone typing their
 *    own password correctly never accumulates a budget against themselves.
 *  - per IP: 30 attempts, charged on every request. Catches credential stuffing
 *    that spreads across many accounts from one host, while staying loose enough
 *    for a clinic behind a single NAT egress.
 *
 * State is per process. With one backend process that is the whole picture; if
 * this is ever scaled horizontally the counters become per-instance and the
 * effective limit multiplies by the instance count — move to a shared store then.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_IDENTITY = 5;
const MAX_ATTEMPTS_PER_IP = 30;

/** Expired entries are swept lazily once the map grows past this. */
const SWEEP_THRESHOLD = 10_000;

type Bucket = { count: number; expiresAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Clears every counter. Backend tests share one module instance (vitest.config.ts
 * sets `pool: 'forks'` with `singleFork: true`), so without this in a beforeEach
 * failed-login assertions accumulate across files and eventually 429 instead.
 */
export function resetAllRateLimits(): void {
  buckets.clear();
}

/** Seconds left in the window if `key` is at or over `limit`, otherwise null. */
function retryAfterIfOver(key: string, limit: number, now: number): number | null {
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.expiresAt) return null;
  if (bucket.count < limit) return null;
  return Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000));
}

function charge(key: string, now: number): void {
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.expiresAt) {
    if (buckets.size >= SWEEP_THRESHOLD) {
      for (const [k, b] of buckets) {
        if (now >= b.expiresAt) buckets.delete(k);
      }
    }
    buckets.set(key, { count: 1, expiresAt: now + WINDOW_MS });
    return;
  }
  bucket.count += 1;
}

/**
 * The caller's address as seen through nginx.
 *
 * The socket peer is always 127.0.0.1 here, so it tells us nothing. nginx sets
 * X-Real-IP from $remote_addr, overwriting whatever the client sent — that is the
 * one value a client cannot forge. X-Forwarded-For is $proxy_add_x_forwarded_for,
 * which appends to any header the client supplied, so only its LAST element comes
 * from our proxy; reading the first would let anyone mint a fresh bucket per
 * request by sending their own X-Forwarded-For.
 */
function clientIp(c: Context): string {
  const realIp = c.req.header('X-Real-IP');
  if (realIp) return realIp.trim();

  const forwarded = c.req.header('X-Forwarded-For');
  if (forwarded) {
    const hops = forwarded.split(',');
    const lastHop = hops[hops.length - 1]?.trim();
    if (lastHop) return lastHop;
  }

  // Direct access (tests, local dev). Everyone shares one bucket, which is only
  // safe because the per-IP limit is the loose one.
  return 'unknown';
}

/**
 * The submitted login, lowercased. Hono caches the parsed body, so reading it
 * here does not stop the zValidator downstream from reading it again.
 */
async function readLogin(c: Context): Promise<string> {
  try {
    const body = await c.req.json();
    return typeof body?.login === 'string' ? body.login.trim().toLowerCase() : '';
  } catch {
    // Malformed or absent JSON — the validator will reject it in a moment. Group
    // these together rather than skipping the per-IP charge.
    return '';
  }
}

export const loginRateLimit: MiddlewareHandler = async (c, next) => {
  const now = Date.now();
  const ip = clientIp(c);
  const identityKey = `identity:${ip}:${await readLogin(c)}`;
  const ipKey = `ip:${ip}`;

  const retryAfter =
    retryAfterIfOver(identityKey, MAX_FAILURES_PER_IDENTITY, now) ??
    retryAfterIfOver(ipKey, MAX_ATTEMPTS_PER_IP, now);

  if (retryAfter !== null) {
    // Returned, not thrown. app.ts's onError rebuilds the response from
    // err.status and err.message and discards getResponse(), so a thrown
    // HTTPException would silently lose the Retry-After header.
    return c.json(
      { error: 'Too many login attempts. Please wait a few minutes and try again.' },
      429,
      { 'Retry-After': String(retryAfter) }
    );
  }

  charge(ipKey, now);

  try {
    await next();
  } catch (error) {
    // auth.service.login() throws HTTPException(401) rather than returning a
    // response. Without charging here every failed login would be free and the
    // per-identity bucket would never fill.
    if (error instanceof HTTPException && error.status === 401) {
      charge(identityKey, now);
    }
    throw error;
  }

  // Covers a future refactor that returns a 401 instead of throwing one.
  if (c.res.status === 401) {
    charge(identityKey, now);
  }
};
