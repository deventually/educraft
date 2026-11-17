import { describe, expect, it } from "vitest";
import {
  gateJson,
  gatePrompt,
  gateTexts,
  type GatePolicy,
  restoreJson,
  restoreStream,
} from "~/lib/privacy/gate";

/**
 * The anonymiseerpoort's pure core (PR 2): one engine (`findRedactions`) over everything that
 * leaves the server, with the names the app knows. Seams: `gateTexts`, `gatePrompt`, `gateJson`
 * and the restorers.
 */
const known = { teacher: "Mark de Groot", colleagues: ["Fatima el Amrani", "Bas", "Roos Jansen"] };
const policy = (over: Partial<GatePolicy> = {}): GatePolicy => ({
  known,
  mode: "replace",
  ...over,
});

async function* chunks(...parts: string[]) {
  for (const p of parts) yield p;
}
async function collect(it: AsyncIterable<string>) {
  const out: string[] = [];
  for await (const c of it) out.push(c);
  return out;
}

describe("names the app knows", () => {
  it("gives the teacher [DOCENT] and colleagues a numbered [COLLEGA-n]", () => {
    const r = gateTexts(["Mark de Groot overlegt met Fatima el Amrani en Roos Jansen."], policy());
    expect(r.send && r.texts).toEqual(["[DOCENT] overlegt met [COLLEGA-1] en [COLLEGA-3]."]);
  });

  it("leaves a one-word colleague name alone as an ordinary word", () => {
    const r = gateTexts(["Bas en roos zijn planten. Ik sprak met Bas over de toets."], policy());
    expect(r.send && r.texts).toEqual([
      "Bas en roos zijn planten. Ik sprak met [COLLEGA-2] over de toets.",
    ]);
  });

  it("keeps researchers and the teacher's own keep words", () => {
    const r = gateTexts(
      ["Volgens Groot en Bloom werkt dit; Jansen ook."],
      policy({ keep: ["Jansen"] }),
    );
    expect(r.send && r.texts).toEqual(["Volgens [DOCENT] en Bloom werkt dit; Jansen ook."]);
  });

  it("uses the same code for the same value across every part", () => {
    const r = gateTexts(["Mail jan@school.nl.", "Nogmaals: jan@school.nl en Mark."], policy());
    expect(r.send && r.texts).toEqual(["Mail [E-MAIL-1].", "Nogmaals: [E-MAIL-1] en [DOCENT]."]);
    expect(r.send && r.codes).toEqual({ "E-MAIL-1": "jan@school.nl", DOCENT: "Mark" });
  });

  it("never reuses a code the browser already put in the text", () => {
    const r = gateTexts(["[E-MAIL-1] schreef aan piet@school.nl over [STUDENT]."], policy());
    expect(r.send && r.texts).toEqual(["[E-MAIL-1] schreef aan [E-MAIL-2] over [STUDENT]."]);
    expect(r.send && r.codes).toEqual({ "E-MAIL-2": "piet@school.nl" });
  });

  it("counts per kind, never which words", () => {
    const r = gateTexts(
      ["Vandaag Mark, Fatima el Amrani en jan@school.nl, 06 12345678."],
      policy(),
    );
    expect(r.counts).toEqual({ teacher: 1, colleague: 1, email: 1, phone: 1 });
  });
});

describe("the names that come back", () => {
  it("come back as the teacher wrote them when every occurrence is spelt the same", () => {
    const r = gateTexts(["Ik vroeg het aan Fatima, en Fatima wist het."], policy());
    expect(r.send && r.codes).toEqual({ "COLLEGA-1": "Fatima" });
  });

  it("come back as the full name when the spellings differ", () => {
    const r = gateTexts(["Ik vroeg het aan Fatima el Amrani, en Fatima wist het."], policy());
    expect(r.send && r.codes).toEqual({ "COLLEGA-1": "Fatima el Amrani" });
  });
});

describe("the three modes", () => {
  const text = "Mark de Groot mailt jan@school.nl.";

  it("count: sends the text unchanged and only counts", () => {
    const r = gateTexts([text], policy({ mode: "count" }));
    expect(r).toEqual({ send: true, texts: [text], codes: {}, counts: { teacher: 1, email: 1 } });
  });

  it("review: sends nothing when something was not seen, and lists it per word", () => {
    const r = gateTexts(
      [`${text} Ook Mark weet het.`],
      policy({ mode: "review", approved: ["jan@school.nl"] }),
    );
    expect(r.send).toBe(false);
    expect(!r.send && r.review).toEqual([
      { value: "Mark de Groot", code: "DOCENT", kind: "teacher", count: 2 },
    ]);
  });

  it("review: replaces everything once all of it was seen", () => {
    const r = gateTexts(
      [text],
      policy({ mode: "review", approved: ["mark de groot", "JAN@school.nl"] }),
    );
    expect(r.send && r.texts).toEqual(["[DOCENT] mailt [E-MAIL-1]."]);
  });

  it("review: a word the teacher chose to keep is neither replaced nor asked", () => {
    const r = gateTexts(
      [text],
      policy({ mode: "review", approved: [], keep: ["Mark de Groot", "jan@school.nl"] }),
    );
    expect(r).toEqual({ send: true, texts: [text], codes: {}, counts: {} });
  });
});

describe("a prompt", () => {
  it("adds one sentence about codes to the system prompt, only when something was replaced", () => {
    const r = gatePrompt(
      { system: "Je bent een coach.", messages: [{ role: "user", content: "Ik ben Mark." }] },
      policy(),
      "nl",
    );
    expect(r.send && r.messages).toEqual([{ role: "user", content: "Ik ben [DOCENT]." }]);
    expect(r.send && r.system).toMatch(/^Je bent een coach\.\n\n.*\[COLLEGA-1\].*personen/s);
    const none = gatePrompt({ system: "Je bent een coach.", messages: [] }, policy(), "en");
    expect(none.send && none.system).toBe("Je bent een coach.");
  });
});

describe("putting the names back", () => {
  const codes = { "COLLEGA-2": "Bas", DOCENT: "Mark de Groot" };

  it("restores a code split over two chunks, and passes the rest on at once", async () => {
    const out = await collect(
      restoreStream(chunks("Vraag het [COLL", "EGA-2] en [DOC", "ENT]."), codes),
    );
    expect(out.join("")).toBe("Vraag het Bas en Mark de Groot.");
    expect(out[0]).toBe("Vraag het ");
  });

  it("lets a bracket that is no code through, and leaves an unknown code visible", async () => {
    const out = await collect(restoreStream(chunks("Zie [1] en [ONBEKEND-9", "] [a"), codes));
    expect(out.join("")).toBe("Zie [1] en [ONBEKEND-9] [a");
  });

  it("passes the stream through untouched without codes", async () => {
    expect(await collect(restoreStream(chunks("a", "[b"), {}))).toEqual(["a", "[b"]);
  });
});

describe("Jev's structured requests", () => {
  it("gates every string in the state and restores the strings in the answer", () => {
    const r = gateJson(
      { file: "verslag Mark de Groot.pdf", n: 3, list: ["Bas zei", "Wij en Bas"] },
      policy(),
    );
    expect(r.send && r.value).toEqual({
      file: "verslag [DOCENT].pdf",
      n: 3,
      list: ["Bas zei", "Wij en [COLLEGA-2]"],
    });
    expect(restoreJson({ why: ["[DOCENT] koos"], p: 0.4 }, r.send ? r.codes : {})).toEqual({
      why: ["Mark de Groot koos"],
      p: 0.4,
    });
  });
});
