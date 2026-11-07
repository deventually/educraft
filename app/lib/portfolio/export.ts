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
import { AlignmentType, HeadingLevel, PageBreak, Paragraph, type Table, TextRun } from "docx";
import { blocksToDocx, LANGUAGE, listCounter, packDocx } from "~/lib/export/docx";
import { safeFileName } from "~/lib/export/filename";
import { fmt } from "~/lib/i18n/format";
import { getMessages, type Locale } from "~/lib/i18n";
import { parseMarkdown } from "~/lib/export/markdown";
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
  const nextList = listCounter();

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
    if (blocks.length) body.push(...blocksToDocx(blocks, nextList, 1));
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
          ? blocksToDocx(parseMarkdown(e.text), nextList, 2)
          : plainParagraphs(e.text)),
      );
    });
  }

  return packDocx(name, locale, [...titlePage, ...body]);
}

/** A safe download name: no path or control characters, always `.docx`. */
export function exportFileName(name: string): string {
  return safeFileName(name, "docx", "dossier");
}
