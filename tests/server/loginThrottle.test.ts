import { describe, it, expect } from "vitest";
import { createAttemptLimiter, clientKeys } from "~/server/loginThrottle.server";

const MIN = 60_000;

function limiter(over: Partial<Parameters<typeof createAttemptLimiter>[0]> = {}) {
  let now = 1_000_000;
  const l = createAttemptLimiter({
    maxFailures: 3,
    windowMs: 15 * MIN,
    lockoutMs: 15 * MIN,
    now: () => now,
    ...over,
  });
  return { l, advance: (ms: number) => (now += ms) };
}

describe("createAttemptLimiter", () => {
  it("lets a key through until it has maxFailures failures", () => {
    const { l } = limiter();
    for (let i = 0; i < 3; i++) {
      expect(l.check(["email:a@x.nl"]).ok).toBe(true);
      l.recordFailure(["email:a@x.nl"]);
    }
    const gate = l.check(["email:a@x.nl"]);
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.retryAfterMs).toBe(15 * MIN);
  });

  it("locks one key without touching another", () => {
    const { l } = limiter();
    for (let i = 0; i < 3; i++) l.recordFailure(["email:a@x.nl"]);
    expect(l.check(["email:a@x.nl"]).ok).toBe(false);
    expect(l.check(["email:b@x.nl"]).ok).toBe(true);
  });

  it("is locked when any of the keys is locked", () => {
    const { l } = limiter();
    for (let i = 0; i < 3; i++) l.recordFailure(["ip:1.2.3.4"]);
    expect(l.check(["email:a@x.nl", "ip:1.2.3.4"]).ok).toBe(false);
  });

  it("opens again once the lockout has passed", () => {
    const { l, advance } = limiter();
    for (let i = 0; i < 3; i++) l.recordFailure(["email:a@x.nl"]);
    advance(15 * MIN - 1);
    expect(l.check(["email:a@x.nl"]).ok).toBe(false);
    advance(1);
    expect(l.check(["email:a@x.nl"]).ok).toBe(true);
  });

  it("forgets failures older than the window", () => {
    const { l, advance } = limiter();
    l.recordFailure(["email:a@x.nl"]);
    l.recordFailure(["email:a@x.nl"]);
    advance(15 * MIN + 1);
    l.recordFailure(["email:a@x.nl"]);
    expect(l.check(["email:a@x.nl"]).ok).toBe(true);
  });

  it("reset clears a key's failures", () => {
    const { l } = limiter();
    l.recordFailure(["email:a@x.nl"]);
    l.recordFailure(["email:a@x.nl"]);
    l.reset("email:a@x.nl");
    l.recordFailure(["email:a@x.nl"]);
    expect(l.check(["email:a@x.nl"]).ok).toBe(true);
  });

  it("stays bounded in memory: the oldest key is dropped past maxKeys", () => {
    const { l } = limiter({ maxKeys: 2 });
    for (let i = 0; i < 3; i++) l.recordFailure(["email:a@x.nl"]);
    l.recordFailure(["email:b@x.nl"]);
    l.recordFailure(["email:c@x.nl"]);
    expect(l.size()).toBe(2);
  });
});

describe("clientKeys", () => {
  const req = (headers: Record<string, string> = {}) =>
    new Request("http://localhost/login", { method: "POST", headers });

  it("keys on the email, case- and space-insensitive", () => {
    expect(clientKeys(" Ann@School.NL ", req(), undefined)).toEqual(["email:ann@school.nl"]);
  });

  it("adds the client IP only from the configured header", () => {
    const r = req({ "x-forwarded-for": "9.9.9.9, 10.0.0.1", "cf-connecting-ip": "8.8.8.8" });
    expect(clientKeys("a@x.nl", r, undefined)).toEqual(["email:a@x.nl"]);
    expect(clientKeys("a@x.nl", r, "x-forwarded-for")).toEqual(["email:a@x.nl", "ip:9.9.9.9"]);
    expect(clientKeys("a@x.nl", r, "CF-Connecting-IP")).toEqual(["email:a@x.nl", "ip:8.8.8.8"]);
  });

  it("ignores an empty or missing IP header", () => {
    expect(clientKeys("a@x.nl", req({ "x-forwarded-for": " " }), "x-forwarded-for")).toEqual([
      "email:a@x.nl",
    ]);
  });
});
