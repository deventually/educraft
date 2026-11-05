import { describe, expect, it } from "vitest";
import { TOOL_ICON_NAMES } from "~/components/ToolIcon";
import { ALL_TOOLS } from "~/lib/registry";

describe("ToolIcon", () => {
  it("has an icon for every tool, so none falls back to the generic wrench", () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_ICON_NAMES, `${tool.id}: ${tool.icon}`).toContain(tool.icon);
    }
  });
});
