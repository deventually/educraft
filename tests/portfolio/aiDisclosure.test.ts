import { describe, it, expect } from "vitest";
import { aiDisclosure } from "~/lib/portfolio/aiDisclosure";
import { LU, sampleDossier } from "./fixtures";

const AT = Date.UTC(2026, 10, 10);

describe("aiDisclosure", () => {
  it("is null when the coach was never used", () => {
    expect(aiDisclosure(sampleDossier(), "nl")).toBeNull();
  });

  it("describes review use and gives an APA reference for the model", () => {
    const d = {
      ...sampleDossier(),
      aiLog: [
        { at: AT, action: "review" as const, outcomeId: LU, model: "claude-sonnet-5-5" },
        { at: AT + 1, action: "review" as const, outcomeId: LU, model: "claude-sonnet-5-5" },
      ],
    };
    const text = aiDisclosure(d, "nl") ?? "";
    expect(text).toContain("Claude Sonnet 5.5");
    expect(text).toContain("feedback");
    expect(text).not.toContain("opstellen");
    expect(text).toContain("Anthropic. (2026). Claude Sonnet 5.5 [Large language model].");
  });

  it("names the outcomes where a paragraph was drafted", () => {
    const d = {
      ...sampleDossier(),
      aiLog: [{ at: AT, action: "draft" as const, outcomeId: LU, model: "claude-sonnet-5-5" }],
    };
    expect(aiDisclosure(d, "nl")).toContain("LU1 Doceren");
    expect(aiDisclosure(d, "en")).toContain("first version of a paragraph");
  });

  it("survives a model id that is no longer in the catalog", () => {
    const d = {
      ...sampleDossier(),
      aiLog: [{ at: AT, action: "review" as const, outcomeId: LU, model: "gone-model" }],
    };
    expect(aiDisclosure(d, "en")).toContain("gone-model");
  });
});
