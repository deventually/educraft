import { describe, expect, it } from "vitest";
import { ALL_TOOLS, WORKPLACE_TOOLS, getToolBySlug } from "~/lib/registry";
import { validateTools } from "~/lib/registry/validate";
import { REHEARSAL_CLOSE, REHEARSAL_PROMPT_ID, REHEARSAL_START } from "~/lib/portfolio/rehearsal";

/** P29.3: the rehearsal is one registry entry, outside the tool catalogue. */
describe("workplace tools", () => {
  const rehearsal = getToolBySlug("portfolio-rehearsal");

  it("finds the rehearsal by its slug, as a chat tool that takes its context from the dossier", () => {
    expect(rehearsal).toMatchObject({
      mode: "chat",
      contextFrom: "dossier",
      hiddenFromCatalogue: true,
      storesConversation: false,
    });
    expect(rehearsal?.stages[0].systemPromptId).toBe(REHEARSAL_PROMPT_ID);
  });

  it("is not in the catalogue, so tool availability, admin lists and /tools never show it", () => {
    expect(ALL_TOOLS.some((t) => t.slug === "portfolio-rehearsal")).toBe(false);
    expect(WORKPLACE_TOOLS.every((t) => t.hiddenFromCatalogue)).toBe(true);
  });

  it("starts with the ready words and offers the closing words as a button", () => {
    expect(rehearsal?.chat?.starters).toEqual([REHEARSAL_START]);
    expect(rehearsal?.chat?.quickReplies).toEqual([REHEARSAL_CLOSE]);
  });

  it("validates with the catalogue, its dossier placeholders counted as sourced", () => {
    expect(validateTools([...ALL_TOOLS, ...WORKPLACE_TOOLS])).toEqual([]);
    const withoutDossier = { ...rehearsal!, contextFrom: undefined };
    expect(
      validateTools([withoutDossier])
        .map((i) => i.message)
        .join("\n"),
    ).toMatch(/\{\{framework\}\} has no source/);
  });
});
