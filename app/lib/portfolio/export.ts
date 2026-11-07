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
  /** A line under the title, e.g. the learning outcome of a part. */
  subtitle?: string;
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
function plainBlocks(text: string): Block[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => ({ type: "paragraph", runs: markRuns([{ text: l }]) }));
}

/** A placeholder line for something missing: italic, in yellow (only a draft has them). */
const missing = (text: string): Block[] => [
  { type: "paragraph", runs: [{ text, italic: true, highlight: true }] },
];

function formatDate(now: number, locale: Locale): string {
  return new Intl.DateTimeFormat(LANGUAGE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(now));
}

export interface DossierSection {
  heading: string;
  level: 1 | 2;
  blocks: Block[];
  /** The reference list: one APA line per paragraph, with a hanging indent. */
  references?: true;
}

/**
 * The one in-between form of a dossier export: the Word writer and the print
 * page (PDF) read only this, so both show the same thing.
 */
export interface DossierDoc {
  /** The document title; a draft's starts with the banner. */
  title: string;
  locale: Locale;
  /** Only in a draft: on every page and above the title. */
  banner?: { text: string; note: string };
  titlePage: { title: string; lines: string[] };
  sections: DossierSection[];
}

/** The dossier as a `DossierDoc`. Refuses the final version while an open spot is left. */
export function dossierDoc(input: DossierExportInput): DossierDoc {
  const { name, data, locale, now, aiDisclosure, draft = false, subtitle } = input;
  if (!draft) {
    const spots = openSpots(data);
    if (spots.length) throw new OpenSpotsError(spots);
  }
  const t = getMessages(locale).portfolioExport;
  const { framework } = data;
  const words = data.chapters.reduce((n, ch) => n + wordCount(ch.text), 0);
  const sections: DossierSection[] = [];

  for (const o of framework.outcomes) {
    const chapter = data.chapters.find((ch) => ch.outcomeId === o.id);
    const blocks = chapter ? parseMarkdown(chapter.text) : [];
    sections.push({
      heading: [o.code.trim(), o.title.trim()].filter(Boolean).join(" "),
      level: 1,
      blocks: blocks.length ? markBlocks(blocks) : missing(t.noChapter),
    });
  }
  if (aiDisclosure?.trim())
    sections.push({ heading: t.aiDisclosure, level: 1, blocks: plainBlocks(aiDisclosure) });
  if (data.references.length) {
    const collator = new Intl.Collator(LANGUAGE[locale], { sensitivity: "base" });
    const sorted = [...data.references].map((r) => r.apa.trim()).sort(collator.compare);
    sections.push({
      heading: t.references,
      level: 1,
      blocks: sorted.map((apa) => ({ type: "paragraph", runs: [{ text: apa }] })),
      references: true,
    });
  }
  if (data.evidence.length) {
    sections.push({ heading: t.appendices, level: 1, blocks: [] });
    data.evidence.forEach((e, i) => {
      // A course snapshot (P26.4) is our own Markdown, with tables; pasted
      // evidence is the teacher's text and stays as typed.
      sections.push({
        heading: fmt(t.appendix, { n: i + 1, title: e.title }),
        level: 2,
        blocks: !e.text.trim()
          ? missing(t.pending)
          : e.sourceCourse
            ? markBlocks(parseMarkdown(e.text))
            : plainBlocks(e.text),
      });
    });
  }

  return {
    title: draft ? `${t.draftHeader}: ${name}` : name,
    locale,
    ...(draft ? { banner: { text: t.draftHeader, note: t.draftNote } } : {}),
    titlePage: {
      title: name,
      lines: [
        ...(subtitle?.trim() ? [subtitle.trim()] : []),
        data.tracks.map((tr) => tr.toUpperCase()).join(" + "),
        ...(framework.institution.trim() ? [framework.institution.trim()] : []),
        ...(framework.year?.trim() ? [fmt(t.year, { year: framework.year.trim() })] : []),
        formatDate(now, locale),
        fmt(t.words, { n: words }),
      ],
    },
    sections,
  };
}

const RED = "C00000";
const HEADING = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2 } as const;

/** The dossier as the bytes of a .docx. */
export async function buildDossierDocx(
  input: DossierExportInput,
): Promise<Uint8Array<ArrayBuffer>> {
  const doc = dossierDoc(input);
  const nextList = listCounter();
  const centered = (text: string) =>
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(text)] });

  // A draft cannot be mistaken for the real thing: a banner above the title too.
  const titlePage: Paragraph[] = [
    ...(doc.banner
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: doc.banner.text, bold: true, color: RED, size: 48 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: doc.banner.note, color: RED })],
          }),
        ]
      : []),
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun(doc.titlePage.title)],
    }),
    ...doc.titlePage.lines.map(centered),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const body: (Paragraph | Table)[] = [];
  for (const s of doc.sections) {
    body.push(new Paragraph({ heading: HEADING[s.level], children: [new TextRun(s.heading)] }));
    if (s.references)
      // APA: hanging indent of 1.27 cm (720 twips).
      for (const b of s.blocks)
        if (b.type === "paragraph")
          body.push(new Paragraph({ indent: { left: 720, hanging: 720 }, children: runs(b.runs) }));
    body.push(...(s.references ? [] : blocksToDocx(s.blocks, nextList, s.level)));
  }

  return packDocx(
    doc.title,
    doc.locale,
    [...titlePage, ...body],
    doc.banner ? { banner: doc.banner.text } : {},
  );
}

/** A safe download name: no path or control characters, always `.docx`; a draft says so. */
export function exportFileName(name: string, opts: { draft?: string } = {}): string {
  const base = safeFileName(name, "docx", "dossier").replace(/\.docx$/, "");
  return opts.draft ? `${base} (${opts.draft}).docx` : `${base}.docx`;
}
