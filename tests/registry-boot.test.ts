import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Tool } from "~/lib/registry/types";
import { ALL_TOOLS } from "~/lib/registry";

// Capture the structured log so we can assert an invalid tool is *reported*.
const { logMock } = vi.hoisted(() => ({ logMock: vi.fn() }));
vi.mock("~/server/log.server", () => ({ log: logMock }));

import { validateRegistry } from "~/lib/registry/boot.server";

/** A valid tool to sit alongside the broken one so filtering is observable. */
function goodTool(): Tool {
  const base = structuredClone(ALL_TOOLS.find((t) => t.slug === "socratic-partner"));
  if (!base) throw new Error("socratic-partner fixture missing");
  return base;
}

/** A structurally broken tool (non-positive maxTokens) with its own slug/id. */
function brokenTool(): Tool {
  const t = goodTool();
  t.slug = "broken-tool";
  t.id = "broken-tool";
  t.defaultMaxTokens = 0; // fails the maxTokens rule → a validation issue
  return t;
}

beforeEach(() => {
  logMock.mockReset();
});

describe("registry boot validation (Phase 5.5)", () => {
  it("in production mode: filters out the invalid tool and reports each issue", () => {
    const result = validateRegistry([goodTool(), brokenTool()], { throwOnInvalid: false });

    // The invalid tool is excluded; the valid one survives.
    expect(result.validTools.map((t) => t.slug)).toEqual(["socratic-partner"]);
    expect(result.invalidSlugs.has("broken-tool")).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);

    // …and it was loudly reported (structured log), not swallowed.
    expect(logMock).toHaveBeenCalled();
    const reportedTools = logMock.mock.calls.map((c) => c[1]?.tool);
    expect(reportedTools).toContain("broken-tool");
  });

  it("in dev mode: throws (fail fast) so a typo never boots silently", () => {
    expect(() => validateRegistry([goodTool(), brokenTool()], { throwOnInvalid: true })).toThrow(
      /broken-tool/,
    );
  });

  it("the real registry passes validation in both modes (no false positive)", () => {
    expect(() => validateRegistry(ALL_TOOLS, { throwOnInvalid: true })).not.toThrow();
    const result = validateRegistry(ALL_TOOLS, { throwOnInvalid: false });
    expect(result.invalidSlugs.size).toBe(0);
    expect(result.validTools.length).toBe(ALL_TOOLS.length);
  });
});
