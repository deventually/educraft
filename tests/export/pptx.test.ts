import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { toExportDoc } from "~/lib/export/doc";
import { exportDocToPptx, PPTX_TYPE } from "~/lib/export/pptx";

const outline = { opening: "Leerdoel", phases: "Lesverloop", closing: "Terugkomen" };

function doc(markdown: string, locale: "nl" | "en" = "nl") {
  return toExportDoc({
    title: "Les voorbereiden",
    locale,
    sections: [{ heading: null, kind: "slides", slides: outline, markdown }],
  });
}

const lesson = [
  "## Leerdoel",
  "",
  "De student legt **fotosynthese** uit.",
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
  "### Afsluiting (5 min)",
  "",
  "- Exitvraag",
  "",
  "## Terugkomen",
  "",
  "- Volgende week: ademhaling.",
].join("\n");

async function open(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const slides = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
  const read = (f: string) => zip.file(f)?.async("string") ?? Promise.resolve("");
  return {
    slides: await Promise.all(slides.map(read)),
    notes: await Promise.all(
      Object.keys(zip.files)
        .filter((f) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f))
        .map(read),
    ),
    core: await read("docProps/core.xml"),
  };
}

describe("exportDocToPptx (P30.4)", () => {
  it("is a PowerPoint file with one slide per slide of the deck", async () => {
    expect(PPTX_TYPE).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    const file = await open(await exportDocToPptx(doc(lesson)));
    expect(file.slides).toHaveLength(4);
  });

  it("gives every slide a real title placeholder, so a screen reader reads it as a heading", async () => {
    const { slides } = await open(await exportDocToPptx(doc(lesson)));
    for (const xml of slides) expect(xml).toMatch(/<p:ph\s[^>]*type="title"/);
    expect(slides[1]).toContain("Voorkennis ophalen (10 min)");
  });

  it("writes a point with bold in it as one valid paragraph: one pPr, plain text", async () => {
    const { slides } = await open(await exportDocToPptx(doc(lesson)));
    // The title is one paragraph, the learning goal the other; each opens with one pPr.
    expect(slides[0]?.match(/<a:p>/g)).toHaveLength(2);
    expect(slides[0]?.match(/<a:pPr[ >]/g)).toHaveLength(2);
    expect(slides[0]).toContain("De student legt fotosynthese uit.");
  });

  it("puts the steps on the slide and the teacher's text in the notes", async () => {
    const { slides, notes } = await open(await exportDocToPptx(doc(lesson)));
    expect(slides[1]).toContain("Wat heeft een plant nodig?");
    expect(slides[1]).not.toContain("De docent vraagt");
    expect(notes.join("")).toContain("De docent vraagt wat planten nodig hebben.");
  });

  it("writes the notes as one paragraph per line, in the document language", async () => {
    const { notes } = await open(await exportDocToPptx(doc(lesson)));
    const phase = notes.find((n) => n.includes("De docent vraagt")) ?? "";
    expect(phase).toContain("<a:t>De docent vraagt wat planten nodig hebben.</a:t>");
    expect(phase).toContain("<a:t>De studenten antwoorden tegelijk.</a:t>");
    expect(phase).not.toContain("Wat heeft een plant nodig?");
    expect(phase).not.toMatch(/<a:t>[^<]*\n/);
    expect(phase).toMatch(/<a:rPr lang="nl-NL"[^>]*\/><a:t>De docent/);
  });

  it("marks the text with the document language", async () => {
    const nl = await open(await exportDocToPptx(doc(lesson)));
    expect(nl.slides[1]).toContain('lang="nl-NL"');
    const en = await open(await exportDocToPptx(doc(lesson, "en")));
    expect(en.slides[1]).toContain('lang="en-GB"');
  });

  it("names the presentation after the result", async () => {
    const { core } = await open(await exportDocToPptx(doc(lesson)));
    expect(core).toContain("<dc:title>Les voorbereiden</dc:title>");
  });

  it("still opens with one title slide when the lesson plan has no slides", async () => {
    const { slides } = await open(await exportDocToPptx(doc("Geen kopjes.")));
    expect(slides).toHaveLength(1);
    expect(slides[0]).toContain("Les voorbereiden");
  });
});
