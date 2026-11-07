import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildDossierDocx, exportFileName, OpenSpotsError } from "~/lib/portfolio/export";
import { wordCount } from "~/lib/portfolio/progress";
import type { DossierData } from "~/lib/portfolio/types";
import { CH, LU, sampleDossier } from "./fixtures";

const LU2 = "00000000-0000-4000-8000-000000000002";
const C3 = "00000000-0000-4000-8000-0000000000c3";
const NOW = Date.UTC(2026, 10, 20);

function richDossier(): DossierData {
  const d = sampleDossier();
  d.framework.outcomes.push({
    id: LU2,
    code: "LU2",
    title: "Toetsen",
    criteria: [{ id: C3, text: "De toets is valide." }],
    requiredEvidence: [],
  });
  d.chapters = [
    {
      id: CH,
      outcomeId: LU,
      text: "## Aanpak\n\nIk **startte** met een vraag.\n\n- punt een\n\n| Kop A | Kop B |\n|---|---|\n| x | y |",
      aiDrafted: false,
    },
    { id: "ch-2", outcomeId: LU2, text: "Mijn toets was valide.", aiDrafted: false },
  ];
  d.references = [
    { id: "r1", apa: "Wiley, D. (2025). The pedagogical promptbook." },
    { id: "r2", apa: "Biggs, J. (2011). Teaching for quality learning." },
    { id: "r3", apa: "ebbens, S. (2015). Effectief leren." },
  ];
  return d;
}

async function documentXml(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("no word/document.xml");
  return file.async("string");
}

/** Paragraph texts in document order, with their style id. */
function paragraphs(xml: string): { style?: string; text: string }[] {
  return [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => {
    const style = /<w:pStyle w:val="([^"]+)"/.exec(m[0])?.[1];
    const text = [...m[0].matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((t) => t[1]).join("");
    return { style, text };
  });
}

describe("buildDossierDocx", () => {
  it("produces a .docx (zip with word/document.xml) in the document language", async () => {
    const bytes = await buildDossierDocx({
      name: "BDB 2026",
      data: richDossier(),
      locale: "nl",
      now: NOW,
    });
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file("word/document.xml")).not.toBeNull();
    const styles = await zip.file("word/styles.xml")?.async("string");
    expect(styles).toContain('w:val="nl-NL"');
    const core = await zip.file("docProps/core.xml")?.async("string");
    expect(core).toContain("BDB 2026");
  });

  it("writes a title page with institution, year, date and word count without appendices", async () => {
    const xml = await documentXml(
      await buildDossierDocx({ name: "BDB 2026", data: richDossier(), locale: "nl", now: NOW }),
    );
    const ps = paragraphs(xml);
    expect(ps[0]).toEqual({ style: "Title", text: "BDB 2026" });
    const texts = ps.map((p) => p.text);
    expect(texts).toContain("Hogeschool X");
    expect(texts).toContain("Studiejaar 2025-2026");
    expect(texts).toContain("20 november 2026");
    // Only the chapters count; the evidence ("Goede opbouw.") is an appendix.
    const words = richDossier().chapters.reduce((n, ch) => n + wordCount(ch.text), 0);
    expect(words).toBeGreaterThan(5);
    expect(texts).toContain(`Aantal woorden (zonder bijlagen): ${words}`);
  });

  it("puts the headings in order: outcomes, references, appendices", async () => {
    const xml = await documentXml(
      await buildDossierDocx({ name: "BDB 2026", data: richDossier(), locale: "nl", now: NOW }),
    );
    const headings = paragraphs(xml)
      .filter((p) => p.style?.startsWith("Heading"))
      .map((p) => `${p.style}:${p.text}`);
    expect(headings).toEqual([
      "Heading1:LU1 Doceren",
      "Heading2:Aanpak",
      "Heading1:LU2 Toetsen",
      "Heading1:Bronnenlijst",
      "Heading1:Bijlagen",
      "Heading2:Bijlage 1. Feedback werkplekbegeleider",
    ]);
  });

  it("renders lists and tables with a repeating header row", async () => {
    const xml = await documentXml(
      await buildDossierDocx({ name: "BDB", data: richDossier(), locale: "nl", now: NOW }),
    );
    expect(xml).toContain("<w:numPr>");
    expect(xml).toContain("<w:tblHeader");
    expect(xml).toMatch(/<w:b\/>[\s\S]*?startte/);
  });

  it("sorts the reference list alphabetically, as typed", async () => {
    const ps = paragraphs(
      await documentXml(
        await buildDossierDocx({ name: "BDB", data: richDossier(), locale: "nl", now: NOW }),
      ),
    ).map((p) => p.text);
    const start = ps.indexOf("Bronnenlijst");
    expect(ps.slice(start + 1, start + 4)).toEqual([
      "Biggs, J. (2011). Teaching for quality learning.",
      "ebbens, S. (2015). Effectief leren.",
      "Wiley, D. (2025). The pedagogical promptbook.",
    ]);
  });

  it("includes the AI disclosure only when it is passed in", async () => {
    const without = await documentXml(
      await buildDossierDocx({ name: "BDB", data: richDossier(), locale: "nl", now: NOW }),
    );
    expect(without).not.toContain("Verantwoording AI-gebruik");
    const withIt = paragraphs(
      await documentXml(
        await buildDossierDocx({
          name: "BDB",
          data: richDossier(),
          locale: "nl",
          now: NOW,
          aiDisclosure: "Ik gebruikte LimeOnIt voor feedback.",
        }),
      ),
    );
    const texts = withIt.map((p) => p.text);
    const at = texts.indexOf("Verantwoording AI-gebruik");
    expect(at).toBeGreaterThan(-1);
    expect(texts[at + 1]).toBe("Ik gebruikte LimeOnIt voor feedback.");
    expect(at).toBeLessThan(texts.indexOf("Bronnenlijst"));
  });

  it("speaks English when the locale is en and leaves out empty sections", async () => {
    const d = sampleDossier();
    d.evidence = [];
    const xml = await documentXml(
      await buildDossierDocx({ name: "Portfolio", data: d, locale: "en", now: NOW }),
    );
    const texts = paragraphs(xml).map((p) => p.text);
    expect(texts).toContain("20 November 2026");
    expect(texts).toContain("Word count (excluding appendices): 6");
    expect(texts).not.toContain("References");
    expect(texts).not.toContain("Appendices");
  });

  it("refuses to write the final version while an open spot is left", async () => {
    const d = richDossier();
    d.chapters[1].text = "Mijn toets was valide. [aanvullen: de p-waarden]";
    await expect(
      buildDossierDocx({ name: "BDB", data: d, locale: "nl", now: NOW }),
    ).rejects.toBeInstanceOf(OpenSpotsError);
    d.chapters = d.chapters.slice(0, 1);
    await expect(
      buildDossierDocx({ name: "BDB", data: d, locale: "nl", now: NOW }),
    ).rejects.toBeInstanceOf(OpenSpotsError);
  });
});

describe("buildDossierDocx — draft version", () => {
  async function draft(d: DossierData, locale: "nl" | "en" = "nl") {
    const zip = await JSZip.loadAsync(
      await buildDossierDocx({ name: "BDB", data: d, locale, now: NOW, draft: true }),
    );
    const doc = (await zip.file("word/document.xml")?.async("string")) ?? "";
    const read = (re: RegExp) =>
      Promise.all(
        Object.keys(zip.files)
          .filter((f) => re.test(f))
          .map((f) => zip.file(f)?.async("string") ?? ""),
      ).then((xs) => xs.join(""));
    const core = (await zip.file("docProps/core.xml")?.async("string")) ?? "";
    return {
      doc,
      header: await read(/^word\/header\d*\.xml$/),
      footer: await read(/^word\/footer\d*\.xml$/),
      core,
    };
  }

  it("cannot be mistaken for the final version: top and bottom of every page, title page, title", async () => {
    const nl = await draft(richDossier());
    expect(nl.header).toContain("CONCEPT, NIET INLEVEREN");
    expect(nl.footer).toContain("CONCEPT, NIET INLEVEREN");
    expect(nl.core).toContain("CONCEPT, NIET INLEVEREN: BDB");
    const first = paragraphs(nl.doc).slice(0, 3);
    expect(first[0].text).toBe("CONCEPT, NIET INLEVEREN");
    expect(first[1].text).toBe(
      "Deze versie heeft nog open plekken, geel gemarkeerd. Lever hem niet in; los eerst alles op in LimeOnIt.",
    );
    expect(first[2]).toEqual({ style: "Title", text: "BDB" });
    const en = await draft(richDossier(), "en");
    expect(en.header).toContain("DRAFT, DO NOT SUBMIT");
    expect(en.footer).toContain("DRAFT, DO NOT SUBMIT");
  });

  it("marks every open spot in yellow: markers, an empty chapter, evidence still to come", async () => {
    const d = richDossier();
    d.chapters = [{ ...d.chapters[0], text: "Ik begon. [aanvullen: het effect] Daarna." }];
    d.evidence[0].text = "";
    const { doc } = await draft(d);
    const yellow = [
      ...doc.matchAll(
        /<w:r>(?:(?!<\/w:r>)[\s\S])*?<w:highlight w:val="yellow"\/>[\s\S]*?<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g,
      ),
    ].map((m) => m[1]);
    expect(yellow).toEqual(["[aanvullen: het effect]", "(Nog geen tekst.)", "(Volgt nog.)"]);
    // The text around a marker stays as written.
    expect(doc).toContain("Ik begon. ");
    expect(doc).toContain(" Daarna.");
  });

  it("has no CONCEPT header in the final version", async () => {
    const zip = await JSZip.loadAsync(
      await buildDossierDocx({ name: "BDB", data: richDossier(), locale: "nl", now: NOW }),
    );
    const all = await Promise.all(
      Object.keys(zip.files)
        .filter((f) => f.endsWith(".xml"))
        .map((f) => zip.file(f)?.async("string") ?? ""),
    );
    expect(all.join("")).not.toContain("CONCEPT");
  });
});

describe("exportFileName", () => {
  it("makes a safe .docx file name", () => {
    expect(exportFileName("BDB 2026")).toBe("BDB 2026.docx");
    expect(exportFileName('a/b\\c:"d"\n')).toBe("a-b-c--d.docx");
    expect(exportFileName("   ")).toBe("dossier.docx");
    expect(exportFileName("BDB 2026", { draft: "concept" })).toBe("BDB 2026 (concept).docx");
  });
});

describe("chapter heading levels", () => {
  it("maps the chapter's top heading to Heading 2, without skipping a level", async () => {
    const d = sampleDossier();
    d.evidence = [];
    d.chapters[0].text = "# Een\n\ntekst\n\n### Twee";
    const styles = paragraphs(
      await documentXml(await buildDossierDocx({ name: "BDB", data: d, locale: "nl", now: NOW })),
    )
      .filter((p) => p.style?.startsWith("Heading"))
      .map((p) => `${p.style}:${p.text}`);
    expect(styles).toEqual(["Heading1:LU1 Doceren", "Heading2:Een", "Heading3:Twee"]);
  });
});

describe("course snapshots in the appendices (P26.4)", () => {
  const snapshot =
    "## Didactiek 1\n\n### Dekkingsmatrix\n\n| Leeruitkomst | Toets A |\n| --- | --- |\n| LU1 | ✓ **2 vragen** |\n| LU2 | — |";

  function withSnapshot(): DossierData {
    const d = sampleDossier();
    d.evidence.push({
      id: "00000000-0000-4000-8000-0000000000e2",
      title: "Didactiek 1: leeruitkomsten en dekking",
      kind: "other",
      text: snapshot,
      criterionIds: [],
      sourceCourse: { courseId: "c1", part: "outcomes-and-matrix", at: NOW },
    });
    return d;
  }

  it("lays out a course table as a real Word table, not as pipe text", async () => {
    const xml = await documentXml(
      await buildDossierDocx({ name: "BDB", data: withSnapshot(), locale: "nl", now: NOW }),
    );
    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("<w:tblHeader");
    const texts = paragraphs(xml).map((p) => p.text);
    expect(texts.some((t) => t.includes("|"))).toBe(false);
    expect(texts).toEqual(expect.arrayContaining(["Leeruitkomst", "Toets A", "LU1", "✓ 2 vragen"]));
    expect(xml).toMatch(/<w:b\/>[\s\S]*?2 vragen/);
  });

  it("nests the snapshot's headings under its appendix heading", async () => {
    const headings = paragraphs(
      await documentXml(
        await buildDossierDocx({ name: "BDB", data: withSnapshot(), locale: "nl", now: NOW }),
      ),
    )
      .filter((p) => p.style?.startsWith("Heading"))
      .map((p) => `${p.style}:${p.text}`);
    expect(headings.slice(-3)).toEqual([
      "Heading2:Bijlage 2. Didactiek 1: leeruitkomsten en dekking",
      "Heading3:Didactiek 1",
      "Heading4:Dekkingsmatrix",
    ]);
  });

  it("keeps pasted evidence as plain text, markdown signs and all", async () => {
    const d = sampleDossier();
    d.evidence[0].text = "| a | b |\n|---|---|\n* geen lijst";
    const texts = paragraphs(
      await documentXml(await buildDossierDocx({ name: "BDB", data: d, locale: "nl", now: NOW })),
    ).map((p) => p.text);
    expect(texts).toEqual(expect.arrayContaining(["| a | b |", "* geen lijst"]));
  });
});
