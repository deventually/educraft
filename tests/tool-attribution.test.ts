import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_TOOLS } from "~/lib/registry";

describe("attribution: an 'improved' claim needs a measurement (BESLUIT-2026-11-04-22)", () => {
  for (const tool of ALL_TOOLS) {
    const claim = tool.attribution.improvedAfter;
    if (!claim) continue;
    it(`${tool.slug}: the report it cites exists`, () => {
      expect(claim.report).toMatch(/^evals\/reports\/[\w-]+\.md$/);
      expect(existsSync(join(process.cwd(), claim.report))).toBe(true);
      expect(claim.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  }

  it("a tool that explains its adaptation is marked adapted", () => {
    for (const tool of ALL_TOOLS) {
      if (tool.attribution.adaptation) expect(tool.attribution.adapted, tool.slug).toBe(true);
    }
  });
});
