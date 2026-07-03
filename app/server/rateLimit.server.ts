/**
 * A tiny in-memory rate + concurrency limiter. Single-instance deployment makes
 * process-local state sound (no Redis). Two independent budgets per key:
 *   - a sliding request window (`max` requests per `windowMs`), and
 *   - a live concurrency cap (`maxConcurrent` un-released acquisitions).
 *
 * `acquire()` records a hit and reserves a concurrency slot; the caller MUST
 * call the returned `release()` when the work finishes (stream done/errored/
 * disconnected). Idle keys are evicted on release once their window has emptied,
 * so memory stays bounded to currently-active callers.
 */
export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  maxConcurrent: number;
}

export type Acquisition = { ok: true; release: () => void } | { ok: false; retryAfterMs: number };

interface Entry {
  /** Timestamps (ms) of admitted requests within the current window. */
  hits: number[];
  /** Live, un-released acquisitions. */
  concurrent: number;
}

export interface RateLimiter {
  acquire(key: string): Acquisition;
}

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const entries = new Map<string, Entry>();

  const prune = (entry: Entry, now: number) => {
    const cutoff = now - opts.windowMs;
    if (entry.hits.length && entry.hits[0] <= cutoff) {
      entry.hits = entry.hits.filter((t) => t > cutoff);
    }
  };

  const evictIfIdle = (key: string, entry: Entry) => {
    if (entry.hits.length === 0 && entry.concurrent === 0) entries.delete(key);
  };

  return {
    acquire(key: string): Acquisition {
      const now = Date.now();
      let entry = entries.get(key);
      if (!entry) {
        entry = { hits: [], concurrent: 0 };
        entries.set(key, entry);
      }
      prune(entry, now);

      if (entry.hits.length >= opts.max) {
        // Retry once the oldest hit ages out of the window.
        const retryAfterMs = Math.max(1, entry.hits[0] + opts.windowMs - now);
        return { ok: false, retryAfterMs };
      }
      if (entry.concurrent >= opts.maxConcurrent) {
        // A slot frees when an in-flight stream ends; hint a short retry.
        return { ok: false, retryAfterMs: 1_000 };
      }

      entry.hits.push(now);
      entry.concurrent += 1;

      let released = false;
      const captured = entry;
      return {
        ok: true,
        release: () => {
          if (released) return;
          released = true;
          captured.concurrent = Math.max(0, captured.concurrent - 1);
          prune(captured, Date.now());
          evictIfIdle(key, captured);
        },
      };
    },
  };
}
