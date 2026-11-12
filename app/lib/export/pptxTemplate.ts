/**
 * A teacher's or team's own PowerPoint template (brief P30.7b), filled without a new library:
 * the template stays the package, its own slides go out, and the deck's slides come in, each
 * in the template's own "Title and Content" layout. So the master, the theme, the logos and the
 * fonts are the school's; we only write the text into the layout's placeholders and let the
 * layout decide the rest. The speaker notes need a notes master; a template without one gets
 * the one `pptxgenjs` writes.
 *
 * `checkPptxTemplate` is the boundary for an upload: size, a real PowerPoint package, no macros,
 * no zip bomb, and a layout we can fill.
 */
import JSZip from "jszip";
import type { Slide } from "./slides";

export const MAX_TEMPLATE_BYTES = 10 * 1024 * 1024;
/** Unpacked, a template may be this big at most: beyond it the zip is not a template but a bomb. */
const MAX_UNPACKED_BYTES = 50 * 1024 * 1024;
const MAX_ENTRIES = 2000;

const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
};
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const TYPE = "application/vnd.openxmlformats-officedocument.presentationml";
const MAIN = `${TYPE}.presentation.main+xml`;
const TEMPLATE_MAIN = `${TYPE}.template.main+xml`;

export type TemplateError = "tooLarge" | "notPowerPoint" | "macros" | "noLayout";
export type TemplateCheck = { ok: true } | { ok: false; error: TemplateError };

/** What `fillPptxTemplate` needs besides the template: the deck, its language and a notes master. */
export interface FillInput {
  title: string;
  lang: string;
  slides: Slide[];
  /** A package that has a notes master (`pptxgenjs` output), for a template without one. */
  notesSource: Uint8Array;
}

interface Layout {
  file: string;
  titleType: string;
  bodyIdx: string;
}

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const read = async (zip: JSZip, name: string) => (await zip.file(name)?.async("string")) ?? "";

/** The uncompressed size JSZip read from the central directory, without unpacking anything. */
function unpackedSize(file: JSZip.JSZipObject): number {
  const data = (file as unknown as { _data?: { uncompressedSize?: number } })._data;
  return data?.uncompressedSize ?? 0;
}

/** The first layout with a title and a content placeholder: "Title and Content" (`obj`) first. */
async function findLayout(zip: JSZip): Promise<Layout | null> {
  const files = Object.keys(zip.files)
    .filter((n) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/g)?.at(-1)) - Number(b.match(/\d+/g)?.at(-1)));
  const found: (Layout & { obj: boolean })[] = [];
  for (const file of files) {
    const xml = await read(zip, file);
    const title = xml.match(/<p:ph\b[^>]*type="(title|ctrTitle)"/);
    const body = [...xml.matchAll(/<p:ph\b([^>]*)\/?>/g)]
      .map((m) => m[1] ?? "")
      .find(
        (attrs) =>
          /idx="\d+"/.test(attrs) && (!/type="/.test(attrs) || /type="(body|obj)"/.test(attrs)),
      );
    const idx = body?.match(/idx="(\d+)"/)?.[1];
    if (title?.[1] && idx)
      found.push({
        file,
        titleType: title[1],
        bodyIdx: idx,
        obj: /<p:sldLayout\b[^>]*type="obj"/.test(xml),
      });
  }
  const layout = found.find((l) => l.obj) ?? found[0];
  return layout
    ? { file: layout.file, titleType: layout.titleType, bodyIdx: layout.bodyIdx }
    : null;
}

export async function checkPptxTemplate(bytes: Uint8Array): Promise<TemplateCheck> {
  if (bytes.byteLength > MAX_TEMPLATE_BYTES) return { ok: false, error: "tooLarge" };
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    return { ok: false, error: "notPowerPoint" };
  }
  const entries = Object.values(zip.files);
  const unpacked = entries.reduce((sum, f) => sum + unpackedSize(f), 0);
  if (entries.length > MAX_ENTRIES || unpacked > MAX_UNPACKED_BYTES)
    return { ok: false, error: "tooLarge" };
  const types = await read(zip, "[Content_Types].xml");
  if (/macroEnabled/i.test(types) || entries.some((f) => /vbaProject\.bin$/i.test(f.name)))
    return { ok: false, error: "macros" };
  if (!(types.includes(MAIN) || types.includes(TEMPLATE_MAIN)) || !zip.file("ppt/presentation.xml"))
    return { ok: false, error: "notPowerPoint" };
  return (await findLayout(zip)) ? { ok: true } : { ok: false, error: "noLayout" };
}

const RUN = (lang: string, text: string) =>
  `<a:r><a:rPr lang="${lang}" dirty="0"/><a:t>${escapeXml(text)}</a:t></a:r>`;
const paragraphs = (lang: string, lines: string[]) =>
  lines.length
    ? lines.map((l) => `<a:p>${RUN(lang, l)}</a:p>`).join("")
    : `<a:p><a:endParaRPr lang="${lang}"/></a:p>`;
const GROUP = `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>`;

function placeholder(id: number, name: string, ph: string, body: string) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${body}</p:txBody></p:sp>`;
}

function slideXml(slide: Slide, layout: Layout, lang: string): string {
  const title = placeholder(
    2,
    "Title 1",
    `<p:ph type="${layout.titleType}"/>`,
    paragraphs(lang, [slide.title]),
  );
  const body = slide.points.length
    ? placeholder(3, "Content 2", `<p:ph idx="${layout.bodyIdx}"/>`, paragraphs(lang, slide.points))
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"><p:cSld><p:spTree>${GROUP}${title}${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function notesXml(notes: string, lang: string): string {
  const lines = notes.split(/\r?\n/).filter((l) => l.trim());
  const image = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>`;
  const text = placeholder(
    3,
    "Notes Placeholder 2",
    `<p:ph type="body" idx="1"/>`,
    paragraphs(lang, lines),
  );
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:notes xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"><p:cSld><p:spTree>${GROUP}${image}${text}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
}

const rels = (items: string[]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.join("")}</Relationships>`;
const rel = (id: string, type: string, target: string) =>
  `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`;
const override = (part: string, type: string) =>
  `<Override PartName="${part}" ContentType="${type}"/>`;

/** The highest number used in names like `prefix<n>`, so a new one never collides. */
const highest = (names: string[], re: RegExp) =>
  Math.max(0, ...names.map((n) => Number(n.match(re)?.[1] ?? 0)));

/** The template's notes master, or the one from `notesSource` (with its theme) moved in. */
async function ensureNotesMaster(
  zip: JSZip,
  notesSource: Uint8Array,
  types: string[],
): Promise<string | null> {
  const own = Object.keys(zip.files).find((n) =>
    /^ppt\/notesMasters\/notesMaster\d+\.xml$/.test(n),
  );
  if (own) return null;
  const source = await JSZip.loadAsync(notesSource);
  const master = await read(source, "ppt/notesMasters/notesMaster1.xml");
  const masterRels = await read(source, "ppt/notesMasters/_rels/notesMaster1.xml.rels");
  const themeTarget = masterRels.match(/Target="\.\.\/theme\/(theme\d+\.xml)"/)?.[1];
  const theme = themeTarget ? await read(source, `ppt/theme/${themeTarget}`) : "";
  if (!master || !theme) return null;
  const n = highest(Object.keys(zip.files), /^ppt\/theme\/theme(\d+)\.xml$/) + 1;
  zip.file(`ppt/theme/theme${n}.xml`, theme);
  zip.file("ppt/notesMasters/notesMaster1.xml", master);
  zip.file(
    "ppt/notesMasters/_rels/notesMaster1.xml.rels",
    rels([rel("rId1", "theme", `../theme/theme${n}.xml`)]),
  );
  types.push(
    override(`/ppt/theme/theme${n}.xml`, "application/vnd.openxmlformats-officedocument.theme+xml"),
    override("/ppt/notesMasters/notesMaster1.xml", `${TYPE}.notesMaster+xml`),
  );
  return "notesMasters/notesMaster1.xml";
}

/** The template with its own slides replaced by `input.slides`. Run `checkPptxTemplate` first. */
export async function fillPptxTemplate(
  template: Uint8Array,
  input: FillInput,
): Promise<Uint8Array<ArrayBuffer>> {
  const zip = await JSZip.loadAsync(template);
  const layout = await findLayout(zip);
  if (!layout) throw new Error("template without a usable layout");

  // Out with the template's own slides, their notes and everything pointing at them.
  for (const name of Object.keys(zip.files))
    if (/^ppt\/(slides|notesSlides)\//.test(name)) zip.remove(name);
  let presRels = (await read(zip, "ppt/_rels/presentation.xml.rels")).replace(
    /<Relationship\b[^>]*Type="[^"]*\/relationships\/slide"[^>]*\/>/g,
    "",
  );
  let presentation = (await read(zip, "ppt/presentation.xml"))
    .replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>|<p:sldIdLst\/>/, "")
    .replace(/<p:custShowLst>[\s\S]*?<\/p:custShowLst>/, "")
    .replace(/<p14:sectionLst\b[\s\S]*?<\/p14:sectionLst>/, "");
  let types = (await read(zip, "[Content_Types].xml"))
    .replace(/<Override PartName="\/ppt\/(slides|notesSlides)\/[^"]*"[^>]*\/>/g, "")
    .replace(TEMPLATE_MAIN, MAIN);
  const newTypes: string[] = [];
  let nextRel =
    highest(
      [...presRels.matchAll(/Id="rId(\d+)"/g)].map((m) => `rId${m[1]}`),
      /^rId(\d+)$/,
    ) + 1;

  // A notes master, so the speaker notes have a home.
  const addedMaster = await ensureNotesMaster(zip, input.notesSource, newTypes);
  if (addedMaster) {
    const id = `rId${nextRel++}`;
    presRels = presRels.replace(
      "</Relationships>",
      `${rel(id, "notesMaster", addedMaster)}</Relationships>`,
    );
    presentation = presentation.replace(
      /(<p:sldMasterIdLst>[\s\S]*?<\/p:sldMasterIdLst>)/,
      `$1<p:notesMasterIdLst><p:notesMasterId r:id="${id}"/></p:notesMasterIdLst>`,
    );
  }
  const notesMaster =
    Object.keys(zip.files).find((n) => /^ppt\/notesMasters\/notesMaster\d+\.xml$/.test(n)) ?? "";

  const ids: string[] = [];
  input.slides.forEach((slide, i) => {
    const n = i + 1;
    const id = `rId${nextRel++}`;
    zip.file(`ppt/slides/slide${n}.xml`, slideXml(slide, layout, input.lang));
    const slideRels = [
      rel("rId1", "slideLayout", `../slideLayouts/${layout.file.split("/").at(-1)}`),
    ];
    if (slide.notes && notesMaster) {
      zip.file(`ppt/notesSlides/notesSlide${n}.xml`, notesXml(slide.notes, input.lang));
      zip.file(
        `ppt/notesSlides/_rels/notesSlide${n}.xml.rels`,
        rels([
          rel("rId1", "notesMaster", `../notesMasters/${notesMaster.split("/").at(-1)}`),
          rel("rId2", "slide", `../slides/slide${n}.xml`),
        ]),
      );
      slideRels.push(rel("rId2", "notesSlide", `../notesSlides/notesSlide${n}.xml`));
      newTypes.push(override(`/ppt/notesSlides/notesSlide${n}.xml`, `${TYPE}.notesSlide+xml`));
    }
    zip.file(`ppt/slides/_rels/slide${n}.xml.rels`, rels(slideRels));
    newTypes.push(override(`/ppt/slides/slide${n}.xml`, `${TYPE}.slide+xml`));
    presRels = presRels.replace(
      "</Relationships>",
      `${rel(id, "slide", `slides/slide${n}.xml`)}</Relationships>`,
    );
    ids.push(`<p:sldId id="${256 + i}" r:id="${id}"/>`);
  });

  // The slide list goes right after the masters' lists, as the schema orders them.
  const list = `<p:sldIdLst>${ids.join("")}</p:sldIdLst>`;
  const anchor = presentation.match(
    /<\/p:handoutMasterIdLst>|<\/p:notesMasterIdLst>|<\/p:sldMasterIdLst>/g,
  );
  const after = anchor?.at(-1);
  presentation = after ? presentation.replace(after, `${after}${list}`) : presentation;
  types = types.replace("</Types>", `${newTypes.join("")}</Types>`);

  zip.file("ppt/presentation.xml", presentation);
  zip.file("ppt/_rels/presentation.xml.rels", presRels);
  zip.file("[Content_Types].xml", types);
  const core = await read(zip, "docProps/core.xml");
  if (core)
    zip.file(
      "docProps/core.xml",
      /<dc:title>[\s\S]*?<\/dc:title>|<dc:title\/>/.test(core)
        ? core.replace(
            /<dc:title>[\s\S]*?<\/dc:title>|<dc:title\/>/,
            `<dc:title>${escapeXml(input.title)}</dc:title>`,
          )
        : core.replace(
            "</cp:coreProperties>",
            `<dc:title>${escapeXml(input.title)}</dc:title></cp:coreProperties>`,
          ),
    );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }) as Promise<
    Uint8Array<ArrayBuffer>
  >;
}
