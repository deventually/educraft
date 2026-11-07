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
 *
 * An open spot (`openSpots.ts`) never reaches the final version: the builder
 * refuses it (BESLUIT-2026-11-07-4). A draft version (`draft: true`) always
 * works: "CONCEPT" at the top of every page and every open spot in yellow.
 */
import { AlignmentType, HeadingLevel, PageBreak, Paragraph, type Table, TextRun } from "docx";
import { blocksToDocx, LANGUAGE, listCounter, packDocx, runs } from "~/lib/export/docx";
import { safeFileName } from "~/lib/export/filename";
import { fmt } from "~/lib/i18n/format";
import { getMessages, type Locale } from "~/lib/i18n";
import { type Block, parseMarkdown, type Run } from "~/lib/export/markdown";
import { type OpenSpot, openSpots, splitOnMarkers } from "./openSpots";
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
  /** A draft version: allowed with open spots, marked as such. */
  draft?: boolean;
}

/** The final version was asked for while open spots are left. */
export class OpenSpotsError extends Error {
  constructor(readonly spots: OpenSpot[]) {
    super(`${spots.length} open spot(s) left`);
    this.name = "OpenSpotsError";
  }
}

/** Runs with every marker cut out into its own highlighted run. */
function markRuns(rs: Run[]): Run[] {
  return rs.flatMap((r) =>
    splitOnMarkers(r.text).map((p) => ({
      ...r,
      text: p.text,
      ...(p.marker ? { highlight: true } : {}),
    })),
  );
}

function markBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    switch (b.type) {
      case "heading":
      case "paragraph":
        return { ...b, runs: markRuns(b.runs) };
      case "list":
        return { ...b, items: b.items.map(markRuns) };
      case "table":
        return { ...b, header: b.header.map(markRuns), rows: b.rows.map((r) => r.map(markRuns)) };
      default:
        return b;
    }
  });
}

/** Plain pasted text: one paragraph per non-empty line, open spots marked. */
function plainParagraphs(text: string): Paragraph[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => new Paragraph({ children: runs(markRuns([{ text: l }])) }));
}

/** A placeholder line for something missing: italic, in yellow (only a draft has them). */
const missing = (text: string) =>
  new Paragraph({ children: runs([{ text, italic: true, highlight: true }]) });

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
  const { name, data, locale, now, aiDisclosure, draft = false } = input;
  if (!draft) {
    const spots = openSpots(data);
    if (spots.length) throw new OpenSpotsError(spots);
  }
  const t = getMessages(locale).portfolioExport;
  const { framework } = data;
  const nextList = listCounter();

  const words = data.chapters.reduce((n, ch) => n + wordCount(ch.text), 0);
  const centered = (text: string) =>
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(text)] });

  // A draft cannot be mistaken for the real thing: a banner above the title too.
  const draftBanner: Paragraph[] = draft
    ? [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: t.draftHeader, bold: true, color: "C00000", size: 48 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: t.draftNote, color: "C00000" })],
        }),
      ]
    : [];
  const titlePage: Paragraph[] = [
    ...draftBanner,
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
    if (blocks.length) body.push(...blocksToDocx(markBlocks(blocks), nextList, 1));
    else body.push(missing(t.noChapter));
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
      if (!e.text.trim()) body.push(missing(t.pending));
      else
        body.push(
          ...(e.sourceCourse
            ? blocksToDocx(markBlocks(parseMarkdown(e.text)), nextList, 2)
            : plainParagraphs(e.text)),
        );
    });
  }

  return draft
    ? packDocx(`${t.draftHeader}: ${name}`, locale, [...titlePage, ...body], {
        banner: t.draftHeader,
      })
    : packDocx(name, locale, [...titlePage, ...body]);
}

/** A safe download name: no path or control characters, always `.docx`; a draft says so. */
export function exportFileName(name: string, opts: { draft?: string } = {}): string {
  const base = safeFileName(name, "docx", "dossier").replace(/\.docx$/, "");
  return opts.draft ? `${base} (${opts.draft}).docx` : `${base}.docx`;
}
