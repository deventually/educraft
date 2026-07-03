import { describe, it, expect, afterEach, vi } from "vitest";
import { createRateLimiter } from "~/server/rateLimit.server";

describe("createRateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("admits up to `max` requests in a window, then refuses with a positive retryAfterMs", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 10, maxConcurrent: 100 });

    for (let i = 0; i < 10; i++) {
      const gate = limiter.acquire("ip-a");
      expect(gate.ok, `acquisition ${i + 1} should succeed`).toBe(true);
    }

    const refused = limiter.acquire("ip-a");
    expect(refused.ok).toBe(false);
    if (refused.ok) throw new Error("unreachable");
    expect(refused.retryAfterMs).toBeGreaterThan(0);
  });

  it("keeps windows independent per key", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, maxConcurrent: 100 });
    expect(limiter.acquire("a").ok).toBe(true);
    expect(limiter.acquire("a").ok).toBe(true);
    expect(limiter.acquire("a").ok).toBe(false);
    // A different key has its own budget.
    expect(limiter.acquire("b").ok).toBe(true);
  });

  it("refuses a concurrent acquire past maxConcurrent, then re-admits after release()", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1000, maxConcurrent: 3 });

    const g1 = limiter.acquire("ip-b");
    const g2 = limiter.acquire("ip-b");
    const g3 = limiter.acquire("ip-b");
    expect(g1.ok && g2.ok && g3.ok).toBe(true);

    const g4 = limiter.acquire("ip-b");
    expect(g4.ok).toBe(false);

    // Free one slot; the next acquire is admitted again.
    if (!g1.ok) throw new Error("unreachable");
    g1.release();
    const g5 = limiter.acquire("ip-b");
    expect(g5.ok).toBe(true);
  });

  it("expires the window after windowMs so requests are admitted again", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, maxConcurrent: 100 });

    expect(limiter.acquire("ip-c").ok).toBe(true);
    expect(limiter.acquire("ip-c").ok).toBe(true);
    expect(limiter.acquire("ip-c").ok).toBe(false);

    // Advance beyond the window; the earlier hits fall out of it.
    vi.advanceTimersByTime(60_001);
    expect(limiter.acquire("ip-c").ok).toBe(true);
  });

  it("release() is idempotent (double-release does not free extra slots)", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1000, maxConcurrent: 1 });
    const g1 = limiter.acquire("ip-d");
    if (!g1.ok) throw new Error("unreachable");
    g1.release();
    g1.release();
    // Only one slot exists; a single acquire must succeed and a second must fail.
    expect(limiter.acquire("ip-d").ok).toBe(true);
    expect(limiter.acquire("ip-d").ok).toBe(false);
  });
});
