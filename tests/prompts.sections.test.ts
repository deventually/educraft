import { describe, it, expect } from "vitest";
import { PROMPTS } from "~/lib/prompts";
import { ALL_TOOLS } from "~/lib/registry";

/**
 * Structural enforcement of Phase 3's prompt-skeleton contract (see
 * app/lib/prompts/TEMPLATE.md). These headings are the grep-verifiable acceptance
 * criteria: every prompt has a Voice & Bounds section; every chat prompt has a
 * Multi-turn stability section. The tokens are English and appear in BOTH the .nl
 * and .en variant, which is what makes the check language-independent.
 */
describe("prompt section contract", () => {
  it("every prompt (both languages) has a Voice & Bounds section", () => {
    for (const p of Object.values(PROMPTS)) {
      expect(p.runtime.nl, `${p.id} nl`).toContain("Voice & Bounds");
      expect(p.runtime.en, `${p.id} en`).toContain("Voice & Bounds");
    }
  });

  it("every chat tool's prompt (both languages) has a Multi-turn stability section", () => {
    const chatPromptIds = new Set(
      ALL_TOOLS.filter((t) => t.mode === "chat").flatMap((t) =>
        t.stages.map((s) => s.systemPromptId),
      ),
    );
    expect(chatPromptIds.size, "expected at least one chat tool").toBeGreaterThan(0);
    for (const id of chatPromptIds) {
      const p = PROMPTS[id];
      expect(p, `chat prompt ${id} missing from PROMPTS`).toBeDefined();
      expect(p.runtime.nl, `${id} nl`).toContain("Multi-turn");
      expect(p.runtime.en, `${id} en`).toContain("Multi-turn");
    }
  });
});
