import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { PROMPTS, getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

const tool = () => getToolBySlug("dialogic-encounters")!;
const runtime = (lang: "nl" | "en") =>
  buildSystemPrompt({
    promptId: "dialogic-encounters@v2",
    values: { theorist: "Lev Vygotsky" },
    outputLanguage: lang,
  });

describe("dialogic-encounters@v2 — the book's interview with a theorist", () => {
  it("runs on @v2 and keeps @v1 registered", () => {
    expect(tool().stages[0]?.systemPromptId).toBe("dialogic-encounters@v2");
    const ids = Object.values(PROMPTS).map((p) => p.id);
    expect(ids).toContain("dialogic-encounters@v1");
    expect(ids).toContain("dialogic-encounters@v2");
  });

  it("keeps the real book prompt as verbatim (Module 6 - Tech Talk with a Theorist)", () => {
    const v = getPrompt("dialogic-encounters@v2").verbatim;
    expect(v).toContain("Module 6 - Tech Talk with a Theorist");
    expect(v).toContain(
      "You are a world-renowned expert simulating [Theorist's Name], known for developing [Learning Theory Name].",
    );
    expect(v).toContain("Make your responses clear for a beginner in education.");
    expect(v).toContain("Step 3: Check for Hallucinations with the CRAAP Test");
  });

  it("credits the chapter authors and the prompt's pages, and says what we changed", () => {
    const a = tool().attribution;
    expect(a.authors).toBe("Clark-Stallkamp, Berry, Cole & Lin");
    expect(a.sourcePages).toBe("pp. 100–102");
    expect(a.adapted).toBe(true);
    expect(loc(a.adaptation!, "nl")).toMatch(/interview/i);
    expect(loc(a.adaptation!, "nl")).toMatch(/aanname/i);
    expect(loc(a.adaptation!, "en")).toMatch(/assumption/i);
  });

  for (const lang of ["nl", "en"] as const) {
    it(`names the theorist and resolves every placeholder (${lang})`, () => {
      expect(runtime(lang)).not.toMatch(/\{\{\w+\}\}/);
      expect(runtime(lang)).toContain("Lev Vygotsky");
    });
  }

  it("answers the interview and guards the book's failure modes (nl)", () => {
    const p = runtime("nl").toLowerCase();
    expect(p).toContain("beantwoord de vraag"); // the book: the theorist answers
    expect(p).toContain("eigen begrippen");
    expect(p).toContain("verkeerde aanname"); // p. 89–90
    expect(p).toContain("op de grens");
    expect(p).toContain("na jouw tijd"); // anachronism, p. 96
    expect(p).toContain("voorlopig"); // p. 86
    expect(p).toContain("verzin geen bronnen");
    expect(p).toContain("craap"); // step 3
    expect(p).toContain("geen lijstjes");
    // Meting g: bold terms, lists in the CRAAP turn, 2–4 question marks, and Skinner
    // "meeting halfway" with constructivism.
    expect(p).toContain("geen vet");
    expect(p).toContain("hooguit één vraagteken");
    expect(p).toContain("halverwege");
  });

  it("answers the interview and guards the book's failure modes (en)", () => {
    const p = runtime("en").toLowerCase();
    expect(p).toContain("answer the question");
    expect(p).toContain("own concepts");
    expect(p).toContain("wrong assumption");
    expect(p).toContain("on the boundary");
    expect(p).toContain("after your time");
    expect(p).toContain("provisional");
    expect(p).toContain("never invent sources");
    expect(p).toContain("craap");
    expect(p).toContain("no lists");
    expect(p).toContain("no bold");
    expect(p).toContain("at most one question mark");
    expect(p).toContain("halfway");
  });

  it("is clean Dutch: no leftovers from the old prompt", () => {
    const nl = runtime("nl");
    for (const bad of ["leertheoricus", "Nodigen uit", "pre-service", "commitmenten", "ernstig interesse"]) {
      expect(nl).not.toContain(bad);
    }
  });

  it("uses correct Dutch on the tool page too", () => {
    const t = tool();
    expect(JSON.stringify(t)).not.toContain("leertheoricus");
  });

  it("cites the chapter's theory", () => {
    expect(tool().theory.keyCitations).toContain("Ertmer & Newby (2013)");
  });
});
