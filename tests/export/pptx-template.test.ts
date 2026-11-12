import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { toExportDoc } from "~/lib/export/doc";
import { checkPptxTemplate, MAX_TEMPLATE_BYTES } from "~/lib/export/pptxTemplate";
import { exportDocToPptx } from "~/lib/export/pptx";

/** P30.7b: a teacher's or team's own PowerPoint template, filled with the deck. */
const fixture = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/${name}`));
const school = fixture("template-school.pptx");

const outline = { opening: "Leerdoel", phases: "Lesverloop", closing: "Terugkomen" };
const doc = toExportDoc({
  title: "Les voorbereiden",
  locale: "nl",
  sections: [
    {
      heading: null,
      kind: "slides",
      slides: outline,
      markdown: [
        "## Leerdoel",
        "",
        "De student legt fotosynthese uit & tekent het.",
        "",
        "## Lesverloop",
        "",
        "### Voorkennis ophalen (10 min)",
        "",
        "De docent vraagt wat planten nodig hebben.",
        "",
        "De studenten antwoorden tegelijk.",
        "",
        "- Wat heeft een plant nodig?",
        "",
        "## Terugkomen",
        "",
        "- Volgende week: ademhaling.",
      ].join("\n"),
    },
  ],
});

async function open(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const read = (f: string) => zip.file(f)?.async("string") ?? Promise.resolve("");
  const names = Object.keys(zip.files);
  const numbered = (re: RegExp) =>
    names
      .filter((f) => re.test(f))
      .sort((a, b) => Number(a.match(/\d+/g)?.at(-1)) - Number(b.match(/\d+/g)?.at(-1)));
  const slides = numbered(/^ppt\/slides\/slide\d+\.xml$/);
  return {
    names,
    read,
    slides: await Promise.all(slides.map(read)),
    slideRels: await Promise.all(
      slides.map((s) => read(`${s.replace("slides/", "slides/_rels/")}.rels`)),
    ),
    notes: await Promise.all(numbered(/^ppt\/notesSlides\/notesSlide\d+\.xml$/).map(read)),
    presentation: await read("ppt/presentation.xml"),
    presentationRels: await read("ppt/_rels/presentation.xml.rels"),
    types: await read("[Content_Types].xml"),
  };
}

const fill = (template: Uint8Array) => exportDocToPptx(doc, template);

describe("filling a PowerPoint template (P30.7b)", () => {
  it("replaces the template's own slides with the deck, one slide each", async () => {
    const file = await open(await fill(school));
    expect(file.slides).toHaveLength(3);
    expect(file.slides.join("")).not.toContain("Voorbeelddia van de school");
    expect(file.presentation.match(/<p:sldId /g)).toHaveLength(3);
    expect(file.presentationRels.match(/relationships\/slide"/g)).toHaveLength(3);
    expect(file.types.match(/presentationml\.slide\+xml/g)).toHaveLength(3);
  });

  it("puts every slide in the template's own Title and Content layout", async () => {
    const file = await open(await fill(school));
    for (const rels of file.slideRels)
      expect(rels).toContain('Target="../slideLayouts/slideLayout2.xml"');
  });

  it("keeps the template's master, so its logo, colours and fonts come along", async () => {
    const file = await open(await fill(school));
    expect(await file.read("ppt/slideMasters/slideMaster1.xml")).toContain("Schoollogo");
    expect(file.names).toContain("ppt/theme/theme1.xml");
  });

  it("fills the title and body placeholders, escaped and in the document language", async () => {
    const file = await open(await fill(school));
    const [opening, phase] = file.slides;
    expect(opening).toMatch(/<p:ph type="title"\/>/);
    expect(opening).toContain("<a:t>Leerdoel</a:t>");
    expect(opening).toContain("<a:t>De student legt fotosynthese uit &amp; tekent het.</a:t>");
    expect(phase).toMatch(/<p:ph idx="1"\/>/);
    expect(phase).toContain("<a:t>Wat heeft een plant nodig?</a:t>");
    expect(phase).toContain('lang="nl-NL"');
    expect(phase).not.toContain("De docent vraagt");
  });

  it("writes the speaker notes, one paragraph per line, with a notes master it adds if missing", async () => {
    const file = await open(await fill(school));
    expect(file.names).toContain("ppt/notesMasters/notesMaster1.xml");
    expect(file.presentation).toMatch(
      /<p:notesMasterIdLst><p:notesMasterId r:id="rId\d+"\/><\/p:notesMasterIdLst>/,
    );
    const phaseNotes = file.notes.find((n) => n.includes("De docent vraagt")) ?? "";
    expect(phaseNotes).toContain("<a:t>De docent vraagt wat planten nodig hebben.</a:t>");
    expect(phaseNotes).toContain("<a:t>De studenten antwoorden tegelijk.</a:t>");
  });

  it("uses the template's own notes master when it has one", async () => {
    const file = await open(await fill(fixture("template-school-notes.pptx")));
    expect(
      file.names.filter((n) => /^ppt\/notesMasters\/notesMaster\d+\.xml$/.test(n)),
    ).toHaveLength(1);
    expect(file.notes.join("")).not.toContain("notities");
  });

  it("makes a .potx a presentation", async () => {
    const file = await open(await fill(fixture("template-school.potx")));
    expect(file.types).toContain("presentationml.presentation.main+xml");
    expect(file.types).not.toContain("presentationml.template.main+xml");
    expect(file.slides).toHaveLength(3);
  });

  it("names the presentation after the result", async () => {
    const file = await open(await fill(school));
    expect(await file.read("docProps/core.xml")).toContain("<dc:title>Les voorbereiden</dc:title>");
  });
});

describe("checkPptxTemplate: the upload boundary (P30.7b)", () => {
  async function zipOf(files: Record<string, string | Uint8Array>) {
    const zip = new JSZip();
    for (const [name, data] of Object.entries(files)) zip.file(name, data);
    return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  }
  async function swap(bytes: Uint8Array, name: string, change: (xml: string) => string) {
    const zip = await JSZip.loadAsync(bytes);
    zip.file(name, change((await zip.file(name)?.async("string")) ?? ""));
    return zip.generateAsync({ type: "uint8array" });
  }

  it("accepts a .pptx and a .potx", async () => {
    expect(await checkPptxTemplate(school)).toEqual({ ok: true });
    expect(await checkPptxTemplate(fixture("template-school.potx"))).toEqual({ ok: true });
  });

  it("refuses a file that is not a zip, or too big", async () => {
    expect(await checkPptxTemplate(new TextEncoder().encode("hallo"))).toEqual({
      ok: false,
      error: "notPowerPoint",
    });
    expect(await checkPptxTemplate(new Uint8Array(MAX_TEMPLATE_BYTES + 1))).toEqual({
      ok: false,
      error: "tooLarge",
    });
  });

  it("refuses a Word file or a zip without a presentation", async () => {
    expect(await checkPptxTemplate(fixture("sample.docx"))).toEqual({
      ok: false,
      error: "notPowerPoint",
    });
  });

  it("refuses a file with macros", async () => {
    const pptm = await swap(school, "[Content_Types].xml", (x) =>
      x.replace(
        "presentationml.presentation.main+xml",
        "ms-powerpoint.presentation.macroEnabled.main+xml",
      ),
    );
    expect(await checkPptxTemplate(pptm)).toEqual({ ok: false, error: "macros" });
    const zip = await JSZip.loadAsync(school);
    zip.file("ppt/vbaProject.bin", "x");
    expect(await checkPptxTemplate(await zip.generateAsync({ type: "uint8array" }))).toEqual({
      ok: false,
      error: "macros",
    });
  });

  it("refuses a zip that unpacks to far more than it weighs (a zip bomb)", async () => {
    const bomb = await zipOf({
      "[Content_Types].xml":
        '<Types><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>',
      "ppt/big.xml": "0".repeat(60 * 1024 * 1024),
    });
    expect(await checkPptxTemplate(bomb)).toEqual({ ok: false, error: "tooLarge" });
  });

  it("refuses a template without a layout that has a title and a content area", async () => {
    const zip = await JSZip.loadAsync(school);
    for (const name of Object.keys(zip.files).filter((n) =>
      /slideLayouts\/slideLayout\d+\.xml$/.test(n),
    ))
      zip.file(
        name,
        ((await zip.file(name)?.async("string")) ?? "").replace(
          /<p:ph [^>]*idx="\d+"[^>]*\/>/g,
          "",
        ),
      );
    expect(await checkPptxTemplate(await zip.generateAsync({ type: "uint8array" }))).toEqual({
      ok: false,
      error: "noLayout",
    });
  });
});
