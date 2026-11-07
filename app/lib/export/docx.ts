/**
 * The Word writer (brief P30.1; the markdown layout came from the dossier export,
 * P25.6, which now uses it too). Accessible by design: real heading styles, the
 * document language set, tables with a repeating header row.
 */
import {
  AlignmentType,
  Document,
  HeadingLevel,
  type ISectionOptions,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { Locale } from "~/lib/i18n";
import type { ExportDoc } from "./doc";
import type { Block, Run } from "./markdown";

export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const LANGUAGE: Record<Locale, string> = { nl: "nl-NL", en: "en-GB" };
const ORDERED = "ordered-list";

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

export function runs(rs: Run[]): TextRun[] {
  return rs.map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic }));
}

function cell(rs: Run[], header: boolean): TableCell {
  return new TableCell({
    children: [
      new Paragraph({ children: header ? runs(rs.map((r) => ({ ...r, bold: true }))) : runs(rs) }),
    ],
  });
}

/** Numbers each ordered list from 1; one instance per list. */
export function listCounter(): () => number {
  let lists = 0;
  return () => ++lists;
}

/**
 * Markdown blocks under a heading of level `parent` (0 = none, 1 = under a
 * Heading 1, …). The text's top heading level (# or ##, whichever was used)
 * becomes one deeper and the rest follow, without skipping a level.
 */
export function blocksToDocx(
  blocks: Block[],
  nextList: () => number,
  parent: 0 | 1 | 2,
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

/** A Word document with our language, numbering and the given body. */
export async function packDocx(
  title: string,
  locale: Locale,
  children: ISectionOptions["children"],
): Promise<Uint8Array<ArrayBuffer>> {
  const doc = new Document({
    title,
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
    sections: [{ children }],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}

/** An `ExportDoc` as Word: the title, then each step under a Heading 1 (if named). */
export async function exportDocToDocx(doc: ExportDoc): Promise<Uint8Array<ArrayBuffer>> {
  const nextList = listCounter();
  const body: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(doc.title)] }),
  ];
  for (const s of doc.sections) {
    if (s.heading)
      body.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(s.heading)] }),
      );
    body.push(...blocksToDocx(s.blocks, nextList, s.heading ? 1 : 0));
  }
  return packDocx(doc.title, doc.locale, body);
}
