/**
 * Login throttling against password guessing. In-memory and process-local, like
 * `rateLimit.server.ts`: the app runs as one instance, so no Redis or external
 * service. A restart forgets every failure, which is acceptable for a lockout
 * that lasts minutes.
 *
 * A key collects failed attempts inside a sliding window; at `maxFailures` it is
 * locked for `lockoutMs`. With `maxLockoutMs`, each next lockout of the same key
 * doubles (up to that cap) until `forgetAfterMs` pass without a failure or the key
 * is reset. `check` refuses when any of the given keys is locked.
 * Memory is bounded: past `maxKeys` the least recently touched key is dropped.
 */
export interface AttemptLimiterOptions {
  maxFailures: number;
  windowMs: number;
  lockoutMs: number;
  /** Cap for escalating lockouts; unset means every lockout lasts `lockoutMs`. */
  maxLockoutMs?: number;
  /** How long a key remembers earlier lockouts after the last one ends. */
  forgetAfterMs?: number;
  /** Clock seam for tests. */
  now?: () => number;
  maxKeys?: number;
}

export type AttemptGate = { ok: true } | { ok: false; retryAfterMs: number };

export interface AttemptLimiter {
  check(keys: string[]): AttemptGate;
  recordFailure(keys: string[]): void;
  reset(key: string): void;
  size(): number;
}

interface Entry {
  failures: number[];
  lockedUntil: number;
  /** Lockouts so far, for escalation. */
  lockouts: number;
}

export function createAttemptLimiter(opts: AttemptLimiterOptions): AttemptLimiter {
  const now = opts.now ?? (() => Date.now());
  const maxKeys = opts.maxKeys ?? 10_000;
  const maxLockoutMs = opts.maxLockoutMs ?? opts.lockoutMs;
  const forgetAfterMs = opts.forgetAfterMs ?? 0;
  // A Map keeps insertion order; re-inserting on touch makes the first key the oldest.
  const entries = new Map<string, Entry>();

  const live = (key: string, at: number): Entry | undefined => {
    const entry = entries.get(key);
    if (!entry) return undefined;
    entry.failures = entry.failures.filter((t) => t > at - opts.windowMs);
    if (entry.failures.length === 0 && entry.lockedUntil + forgetAfterMs <= at) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };

  return {
    check(keys) {
      const at = now();
      let retryAfterMs = 0;
      for (const key of keys) {
        const entry = live(key, at);
        if (entry && entry.lockedUntil > at) {
          retryAfterMs = Math.max(retryAfterMs, entry.lockedUntil - at);
        }
      }
      return retryAfterMs > 0 ? { ok: false, retryAfterMs } : { ok: true };
    },

    recordFailure(keys) {
      const at = now();
      for (const key of keys) {
        const entry = live(key, at) ?? { failures: [], lockedUntil: 0, lockouts: 0 };
        entry.failures.push(at);
        if (entry.failures.length >= opts.maxFailures) {
          const duration = Math.min(opts.lockoutMs * 2 ** entry.lockouts, maxLockoutMs);
          entry.lockedUntil = at + duration;
          entry.lockouts += 1;
          entry.failures = [];
        }
        entries.delete(key);
        entries.set(key, entry);
        while (entries.size > maxKeys) {
          const oldest = entries.keys().next().value as string;
          entries.delete(oldest);
        }
      }
    },

    reset(key) {
      entries.delete(key);
    },

    size() {
      return entries.size;
    },
  };
}

/**
 * The limiter keys for one login attempt: always the normalised email, plus the
 * client IP when the deployment names a trusted header for it. react-router-serve
 * does not pass the socket address, and a header is only trustworthy when the
 * reverse proxy sets it, so without `headerName` there is no IP key.
 */
export function clientKeys(
  email: string,
  request: Request,
  headerName: string | undefined,
): [string, ...string[]] {
  const keys: [string, ...string[]] = [`email:${email.trim().toLowerCase()}`];
  if (headerName) {
    const ip = request.headers.get(headerName)?.split(",")[0]?.trim();
    if (ip) keys.push(`ip:${ip}`);
  }
  return keys;
}
