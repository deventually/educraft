import { describe, expect, it } from "vitest";
import { AGENTS } from "~/lib/agents/registry";
import { PROMPTS, getRuntimePrompt } from "~/lib/prompts";

describe("hat prompts (P21.2)", () => {
  for (const agent of AGENTS) {
    describe(agent.id, () => {
      it("is registered with a book-free source note", () => {
        expect(PROMPTS[agent.promptId]).toBeDefined();
        expect(PROMPTS[agent.promptId].verbatim.length).toBeGreaterThan(50);
      });

      for (const locale of ["nl", "en"] as const) {
        it(`${locale}: names every input tag and the JSON contract`, () => {
          const p = getRuntimePrompt(agent.promptId, locale);
          for (const tag of [
            "<course",
            "<outcomes>",
            "<activities>",
            "<assessments>",
            "<checks>",
            "<rejected>",
          ])
            expect(p, tag).toContain(tag);
          for (const key of ['"findings"', '"severity"', '"target"', '"message"', '"suggestion"'])
            expect(p, key).toContain(key);
        });

        it(`${locale}: has no placeholders (the course travels in the message)`, () => {
          expect(getRuntimePrompt(agent.promptId, locale)).not.toMatch(/\{\{/);
        });
      }
    });
  }

  it("the two hats look at different things", () => {
    const a = getRuntimePrompt("agent-assessment@v1", "nl");
    const d = getRuntimePrompt("agent-design@v1", "nl");
    expect(a).toContain("Toetsdeskundige");
    expect(d).toContain("Ontwerper");
    expect(a).not.toBe(d);
  });
});

describe("linked work (P21.7)", () => {
  it("every hat that watches generations names the linked-work tag; v1 stays registered", () => {
    for (const agent of AGENTS.filter((a) => a.watches.includes("generation")))
      for (const locale of ["nl", "en"] as const)
        expect(getRuntimePrompt(agent.promptId, locale), `${agent.id} ${locale}`).toContain(
          "<linkedWork>",
        );
    expect(PROMPTS["agent-assessment@v1"]).toBeDefined();
    expect(PROMPTS["agent-assessment@v2"]).toBeDefined();
  });
});
