import { describe, expect, it } from "vitest";
import { globalConfig } from "zod/v4/core";

process.env.DATABASE_URL ??= "file::memory:";

describe("Zod under a strict CSP", () => {
  it("runs jitless once the root module loads, so it never probes `new Function`", async () => {
    // Zod tries `new Function("")` to decide whether it may compile fast parsers. Our CSP has
    // no 'unsafe-eval', so the browser reports a violation on every page that parses a schema.
    await import("~/root");
    expect(globalConfig.jitless).toBe(true);
  });
});
