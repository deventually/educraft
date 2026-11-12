import { describe, expect, it } from "vitest";
import { GUARD_IDS, guardOutput } from "~/lib/template/guards";
import { validateTools } from "~/lib/registry/validate";
import { getToolBySlugOrThrow } from "~/lib/registry";

/**
 * P36.2 — a stage can name a guard (`output.guard`) that cleans its output in code, after the
 * model and before the teacher sees or keeps it. "input-numbers": a number in digits that is
 * not in the input is dropped, so a count never comes from the model (brief P36, principle 2).
 */
describe("output guards: input-numbers", () => {
  const values = {
    groupSummary:
      "Ronde 2026-11, 12 werken.\n- Analyse: 5 van 12 op het laagste niveau (42%). Niveaus: Onvoldoende 5, Voldoende 4, Goed 3.",
    examples: "",
  };
  const guard = (text: string) => guardOutput("input-numbers", text, values);

  it("is a known guard", () => {
    expect(GUARD_IDS).toContain("input-numbers");
  });

  it("keeps numbers that are in the input, also as a percentage", () => {
    const text = "Bij Analyse zaten 5 van de 12 werken op het laagste niveau (42%).";
    expect(guard(text)).toBe(text);
  });

  it("drops a number that is not in the input, with its percent sign", () => {
    expect(guard("Bij Analyse ging het mis bij 7 studenten.")).toBe(
      "Bij Analyse ging het mis bij … studenten.",
    );
    expect(guard("Dat is 58 % van de groep.")).toBe("Dat is … van de groep.");
    expect(guard("Dat is 58% van de groep.")).toBe("Dat is … van de groep.");
  });

  it("reads a decimal comma and a decimal point as the same number", () => {
    const withComma = { groupSummary: "Gemiddeld 5,5." };
    expect(guardOutput("input-numbers", "Gemiddeld 5.5 en 5,5.", withComma)).toBe(
      "Gemiddeld 5.5 en 5,5.",
    );
    expect(guardOutput("input-numbers", "Gemiddeld 6,5.", withComma)).toBe("Gemiddeld ….");
  });

  it("leaves ordered-list markers and numbers inside words alone", () => {
    const text = "1. Analyse\n2. Bronnen\n   3) Opbouw\nVraag V17 en H2O.";
    expect(guard(text)).toBe(text);
  });

  it("does not let a number match part of a longer one", () => {
    expect(guard("Het betrof 120 werken.")).toBe("Het betrof … werken.");
    expect(guard("Het betrof 1 werk.")).toBe("Het betrof … werk.");
  });

  it("reads numbers from every kind of input value", () => {
    const mixed = { a: 3, b: ["14 werken"], c: true, d: null };
    expect(guardOutput("input-numbers", "3 en 14 en 9", mixed)).toBe("3 en 14 en …");
  });

  it("changes nothing for a stage without a guard", () => {
    expect(guardOutput(undefined, "7 studenten", values)).toBe("7 studenten");
  });

  it("is checked at boot: an unknown guard id is refused", () => {
    const tool = getToolBySlugOrThrow("group-feedback");
    expect(tool.stages[0].output.guard).toBe("input-numbers");
    const bad = {
      ...tool,
      stages: [{ ...tool.stages[0], output: { ...tool.stages[0].output, guard: "nope" } }],
    };
    expect(validateTools([bad as never]).length).toBeGreaterThan(0);
  });
});
