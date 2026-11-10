import { describe, expect, it } from "vitest";
import { AGENTS, getAgent } from "~/lib/agents/registry";
import { PROMPTS, getRuntimePrompt } from "~/lib/prompts";

describe("hat prompts (P21.2)", () => {
  for (const agent of AGENTS) {
    describe(agent.id, () => {
      it("is registered with a book-free source note", () => {
        expect(PROMPTS[agent.promptId]).toBeDefined();
        expect(PROMPTS[agent.promptId]!.verbatim.length).toBeGreaterThan(50);
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

describe("AI resilience reviewer", () => {
  for (const locale of ["nl", "en"] as const) {
    it(`${locale}: reads supervision, stays off the other reviewers' ground, and invents no AI tools`, () => {
      const p = getRuntimePrompt("agent-ai-resilience@v1", locale);
      for (const word of locale === "nl"
        ? ["onder toezicht", "zonder toezicht", "Toetsdeskundige", "Ontwerper"]
        : ["supervised", "unsupervised", "Assessment expert", "Designer"])
        expect(p, word).toContain(word);
    });
  }
});

describe("professional practice reviewer", () => {
  for (const locale of ["nl", "en"] as const) {
    it(`${locale}: reads the pack's professional activities and level, and stays off the other reviewers' ground`, () => {
      const p = getRuntimePrompt("agent-professional-practice@v1", locale);
      for (const word of locale === "nl"
        ? ["beroepsactiviteiten", "beheersingsniveau", "Toetsdeskundige", "Ontwerper"]
        : ["professional activities", "proficiency level", "Assessment expert", "Designer"])
        expect(p, word).toContain(word);
    });
  }
});

describe("student reviewer", () => {
  it("runs v2; v1 stays registered for earlier reviews", () => {
    expect(getAgent("student")?.promptId).toBe("agent-student@v2");
    expect(PROMPTS["agent-student@v1"]).toBeDefined();
  });

  for (const locale of ["nl", "en"] as const) {
    it(`${locale}: v2 warns only for a real clash, not for a lesson in a deadline week`, () => {
      const p = getRuntimePrompt("agent-student@v2", locale);
      for (const word of locale === "nl"
        ? ["twee of meer summatieve", "Eén week ertussen is genoeg", "geen botsing"]
        : ["two or more summative", "One week in between is enough", "not a clash"])
        expect(p, word).toContain(word);
    });

    it(`${locale}: reads the course week by week, and stays off the other reviewers' ground`, () => {
      const p = getRuntimePrompt("agent-student@v2", locale);
      for (const word of locale === "nl"
        ? ["per week", "feedback", "deadline", "Toetsdeskundige", "Ontwerper"]
        : ["week by week", "feedback", "deadline", "Assessment expert", "Designer"])
        expect(p, word).toContain(word);
    });
  }
});

describe("inclusion reviewer", () => {
  for (const locale of ["nl", "en"] as const) {
    it(`${locale}: looks at variety in how students learn and show, and stays off the other reviewers' ground`, () => {
      const p = getRuntimePrompt("agent-inclusion@v1", locale);
      for (const word of locale === "nl"
        ? ["meer dan één manier", "toetsvorm", "Toetsdeskundige", "Ontwerper"]
        : ["more than one way", "assessment form", "Assessment expert", "Designer"])
        expect(p, word).toContain(word);
    });
  }
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
