/**
 * Word export of a BDB/BKE dossier (brief P25.6). One deep function:
 * `buildDossierDocx` takes the dossier and returns the bytes of a .docx.
 *
 * Layout: a title page (name, tracks, institution, year, date, word count
 * without appendices), one Heading 1 per learning outcome with its chapter, the
 * optional AI disclosure, the reference list (alphabetical, as typed), and the
 * evidence as numbered appendices (a course snapshot keeps its tables). References come before appendices, as APA
 * asks. The document is accessible: real heading styles, the document language
 * set, tables with a repeating header row.
 */
import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { fmt } from "~/lib/i18n/format";
import { getMessages, type Locale } from "~/lib/i18n";
import { type Block, parseMarkdown, type Run } from "./markdown";
import { wordCount } from "./progress";
import type { DossierData } from "./types";

export interface DossierExportInput {
  name: string;
  data: DossierData;
  locale: Locale;
  /** Export moment (ms); the title page shows its date. */
  now: number;
  /**
   * A ready AI-disclosure paragraph (from `aiDisclosure.ts`, P25.5). Only passed
   * when the teacher turns it on; absent = no disclosure section.
   */
  aiDisclosure?: string;
}

const LANGUAGE: Record<Locale, string> = { nl: "nl-NL", en: "en-GB" };
const ORDERED = "ordered-list";

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

function runs(rs: Run[]): TextRun[] {
  return rs.map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic }));
}

function cell(rs: Run[], header: boolean): TableCell {
  return new TableCell({
    children: [
      new Paragraph({ children: header ? runs(rs.map((r) => ({ ...r, bold: true }))) : runs(rs) }),
    ],
  });
}

/**
 * Markdown blocks under a heading of level `parent` (an outcome is Heading 1, an
 * appendix Heading 2). The text's top heading level (# or ##, whichever was used)
 * becomes one deeper and the rest follow, without skipping a level.
 */
function markdownBlocks(
  blocks: Block[],
  nextList: () => number,
  parent: 1 | 2,
): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const used = [...new Set(blocks.flatMap((b) => (b.type === "heading" ? [b.level] : [])))].sort();
  for (const b of blocks) {
    if (b.type === "heading") {
      const level = Math.min(used.indexOf(b.level) + parent, 5);
      out.push(new Paragraph({ heading: HEADINGS[level], children: runs(b.runs) }));
    } else if (b.type === "paragraph") {
      out.push(new Paragraph({ children: runs(b.runs) }));
    } else if (b.type === "list") {
      const instance = nextList();
      for (const item of b.items) {
        out.push(
          new Paragraph({
            children: runs(item),
            ...(b.ordered
              ? { numbering: { reference: ORDERED, level: 0, instance } }
              : { bullet: { level: 0 } }),
          }),
        );
      }
    } else {
      const columns = Math.max(b.header.length, ...b.rows.map((r) => r.length));
      const pad = (row: Run[][]) => [...row, ...Array(columns - row.length).fill([])] as Run[][];
      out.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: pad(b.header).map((c) => cell(c, true)) }),
            ...b.rows.map((r) => new TableRow({ children: pad(r).map((c) => cell(c, false)) })),
          ],
        }),
      );
    }
  }
  return out;
}

/** Plain pasted text: one paragraph per non-empty line. */
function plainParagraphs(text: string): Paragraph[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => new Paragraph({ children: [new TextRun(l)] }));
}

function formatDate(now: number, locale: Locale): string {
  return new Intl.DateTimeFormat(LANGUAGE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(now));
}

export async function buildDossierDocx(
  input: DossierExportInput,
): Promise<Uint8Array<ArrayBuffer>> {
  const { name, data, locale, now, aiDisclosure } = input;
  const t = getMessages(locale).portfolioExport;
  const { framework } = data;
  let lists = 0;
  const nextList = () => ++lists;

  const words = data.chapters.reduce((n, ch) => n + wordCount(ch.text), 0);
  const centered = (text: string) =>
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(text)] });

  const titlePage: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun(name)],
    }),
    centered(data.tracks.map((tr) => tr.toUpperCase()).join(" + ")),
    ...(framework.institution.trim() ? [centered(framework.institution.trim())] : []),
    ...(framework.year?.trim() ? [centered(fmt(t.year, { year: framework.year.trim() }))] : []),
    centered(formatDate(now, locale)),
    centered(fmt(t.words, { n: words })),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const body: (Paragraph | Table)[] = [];
  for (const o of framework.outcomes) {
    const heading = [o.code.trim(), o.title.trim()].filter(Boolean).join(" ");
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(heading)] }));
    const chapter = data.chapters.find((ch) => ch.outcomeId === o.id);
    const blocks = chapter ? parseMarkdown(chapter.text) : [];
    if (blocks.length) body.push(...markdownBlocks(blocks, nextList, 1));
    else
      body.push(new Paragraph({ children: [new TextRun({ text: t.noChapter, italics: true })] }));
  }

  if (aiDisclosure?.trim()) {
    body.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t.aiDisclosure)] }),
    );
    body.push(...plainParagraphs(aiDisclosure));
  }

  if (data.references.length) {
    const collator = new Intl.Collator(LANGUAGE[locale], { sensitivity: "base" });
    const sorted = [...data.references].map((r) => r.apa.trim()).sort(collator.compare);
    body.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t.references)] }),
    );
    // APA: hanging indent of 1.27 cm (720 twips).
    for (const apa of sorted)
      body.push(
        new Paragraph({ indent: { left: 720, hanging: 720 }, children: [new TextRun(apa)] }),
      );
  }

  if (data.evidence.length) {
    body.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t.appendices)] }),
    );
    data.evidence.forEach((e, i) => {
      body.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun(fmt(t.appendix, { n: i + 1, title: e.title }))],
        }),
      );
      // A course snapshot (P26.4) is our own Markdown, with tables; pasted
      // evidence is the teacher's text and stays as typed.
      body.push(
        ...(e.sourceCourse
          ? markdownBlocks(parseMarkdown(e.text), nextList, 2)
          : plainParagraphs(e.text)),
      );
    });
  }

  const doc = new Document({
    title: name,
    styles: { default: { document: { run: { language: { value: LANGUAGE[locale] } } } } },
    numbering: {
      config: [
        {
          reference: ORDERED,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [{ children: [...titlePage, ...body] }],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}

/** A safe download name: no path or control characters, always `.docx`. */
export function exportFileName(name: string): string {
  const safe = name
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, "-")
    .trim()
    .replace(/-+$/, "")
    .slice(0, 150);
  return `${safe || "dossier"}.docx`;
}
