/**
 * The PowerPoint writer (brief P30.4, `pptxgenjs`). It lays out the deck of `slides.ts`, so
 * the file holds what the preview shows. Accessible by design: every slide's title sits in a
 * real title placeholder (a screen reader reads it as the slide's heading), the reading order
 * is title then points, and the text carries the document language. One plain master in
 * LimeOnIt's colours for now; the house style (30.7) fills the theme later.
 */
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import type { ExportDoc } from "./doc";
import { LANGUAGE } from "./docx";
import { toSlideDeck } from "./slides";

export const PPTX_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const MASTER = "LIMEONIT";
const FONT = "Calibri";
/** lime-800 on white and slate-900 on white: both far above 4.5:1. */
const TITLE_COLOUR = "3F6212";
const TEXT_COLOUR = "0F172A";

function master(pptx: PptxGenJS) {
  pptx.defineSlideMaster({
    title: MASTER,
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: "100%", h: 0.12, fill: { color: "84CC16" } } },
      {
        placeholder: {
          options: {
            name: "title",
            type: "title",
            x: 0.6,
            y: 0.35,
            w: 12.1,
            h: 1.1,
            fontFace: FONT,
            fontSize: 32,
            bold: true,
            color: TITLE_COLOUR,
            valign: "middle",
            align: "left",
          },
          text: "",
        },
      },
      {
        placeholder: {
          options: {
            name: "body",
            type: "body",
            x: 0.6,
            y: 1.65,
            w: 12.1,
            h: 5.4,
            fontFace: FONT,
            fontSize: 24,
            color: TEXT_COLOUR,
            valign: "top",
          },
          text: "",
        },
      },
    ],
  });
}

/** The notes text as `pptxgenjs` writes it: one run, every line in it, marked en-US. */
const NOTES_RUN =
  /<a:p><a:r><a:rPr lang="[^"]*"([^>]*)\/><a:t>([^<]*)<\/a:t><\/a:r>(<a:endParaRPr[^>]*\/>)?<\/a:p>/g;

/**
 * `addNotes` puts every line in one run, so PowerPoint shows the notes as one block and reads
 * them as English. Rewrite each notes page: one paragraph per line, in the document language.
 */
async function notesPerLine(bytes: ArrayBuffer, lang: string): Promise<Uint8Array<ArrayBuffer>> {
  const zip = await JSZip.loadAsync(bytes);
  for (const name of Object.keys(zip.files).filter((f) =>
    /^ppt\/notesSlides\/[^/]+\.xml$/.test(f),
  )) {
    const xml = await zip.file(name)?.async("string");
    if (!xml) continue;
    zip.file(
      name,
      xml.replace(NOTES_RUN, (_, attrs: string, text: string) =>
        text
          .split(/\r?\n/)
          .filter((line) => line.trim())
          .map((line) => `<a:p><a:r><a:rPr lang="${lang}"${attrs}/><a:t>${line}</a:t></a:r></a:p>`)
          .join(""),
      ),
    );
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }) as Promise<
    Uint8Array<ArrayBuffer>
  >;
}

export async function exportDocToPptx(doc: ExportDoc): Promise<Uint8Array<ArrayBuffer>> {
  const deck = toSlideDeck(doc);
  const lang = LANGUAGE[deck.locale];
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = deck.title;
  pptx.company = "LimeOnIt";
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };
  master(pptx);

  // A lesson plan without the headings still opens: one slide with its title.
  const slides = deck.slides.length ? deck.slides : [{ title: deck.title, points: [], notes: "" }];
  for (const s of slides) {
    const slide = pptx.addSlide({ masterName: MASTER });
    slide.addText(s.title, { placeholder: "title", lang });
    if (s.points.length)
      slide.addText(
        s.points.map((text) => ({ text, options: { bullet: true, breakLine: true, lang } })),
        { placeholder: "body", lang },
      );
    if (s.notes) slide.addNotes(s.notes);
  }
  return notesPerLine((await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer, lang);
}
