import { describe, it, expect, vi } from "vitest";
import { log } from "~/server/log.server";

describe("log.server", () => {
  it("emits a single parseable JSON line carrying ts and event", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("generation", { userId: "u1", outcome: "ok", chars: 42 });

    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.event).toBe("generation");
    expect(typeof parsed.ts).toBe("string");
    expect(Number.isNaN(Date.parse(parsed.ts))).toBe(false);
    expect(parsed.userId).toBe("u1");
    expect(parsed.outcome).toBe("ok");
    expect(parsed.chars).toBe(42);
    spy.mockRestore();
  });

  it("only serializes the fields it is given (no implicit content leakage)", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("generation", { userId: "u1", toolSlug: "math-grading" });
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    // Metadata only — the logger never invents prompt/response payload keys.
    expect(parsed).not.toHaveProperty("prompt");
    expect(parsed).not.toHaveProperty("output");
    expect(parsed).not.toHaveProperty("messages");
    expect(Object.keys(parsed).sort()).toEqual(["event", "toolSlug", "ts", "userId"]);
    spy.mockRestore();
  });
});
