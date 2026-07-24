/**
 * In-memory sliding-window rate limiter.
 *
 * IMPORTANT: This resets on server restart and is NOT shared across instances.
 * Acceptable for the current single-instance Render deployment (WEB_CONCURRENCY=1).
 * If scaling to multiple instances, this MUST be replaced with a shared store
 * (e.g. Redis) — note this as a prerequisite before any future scale-out.
 */

const hits = new Map<string, number[]>();

/**
 * Check whether a request is within the rate limit.
 * Returns `true` if allowed, `false` if rate-limited.
 *
 * @param key    Unique identifier for the action (e.g. "sign-in", "booking")
 * @param limit  Maximum number of requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;

  const timestamps = hits.get(key) ?? [];
  // Prune old entries outside the window
  const recent = timestamps.filter((t) => t > windowStart);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);
  return true;
}

/**
 * Get the client IP from request headers.
 * Render sets x-forwarded-for on proxied requests.
 * Falls back to x-real-ip for other reverse proxies.
 */
export function getClientIp(requestHeaders: Headers): string {
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    "unknown"
  );
}
