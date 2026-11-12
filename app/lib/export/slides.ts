/**
 * A lesson plan as slides (brief P30.4), pure. The deck is read in code from what the model
 * already wrote, never added to: an opening slide (the learning goal and success criterion),
 * a slide per phase of the outline and a closing slide (coming back in later lessons). Which
 * headings those are is registry data (`OutputFormat.slides`), so nothing here knows a tool or a
 * language. The steps of a phase go on the slide; everything written for the teacher goes in
 * the speaker notes. A point is plain text: `pptxgenjs` cannot mix bold and plain text in one
 * bulleted line without writing an invalid paragraph. The file and the preview read this deck.
 */
import type { Locale } from "~/lib/i18n";
import { type LocalizedText, loc } from "~/lib/i18n/localized";
import type { ExportDoc } from "./doc";
import type { Block, Run } from "./markdown";

/** The headings a deck is made from, as written in the result's language. */
export interface SlideHeadings {
  opening: string;
  phases: string;
  closing: string;
}

export interface Slide {
  title: string;
  /** One line per point, as plain text. */
  points: string[];
  /** Speaker notes: the teacher's text of this part, as plain text. */
  notes: string;
}

export interface SlideDeck {
  title: string;
  locale: Locale;
  slides: Slide[];
}

/** More points than this go to a next slide; the text is never made smaller. */
export const MAX_POINTS = 6;

const CONTINUED: LocalizedText = { nl: "(vervolg)", en: "(continued)" };

/** The registry's outline in the result's language, for the export (undefined: no slides). */
export function slideHeadings(
  outline: Record<keyof SlideHeadings, LocalizedText> | undefined,
  locale: Locale,
): SlideHeadings | undefined {
  if (!outline) return undefined;
  return {
    opening: loc(outline.opening, locale),
    phases: loc(outline.phases, locale),
    closing: loc(outline.closing, locale),
  };
}

const plain = (runs: Run[]) => runs.map((r) => r.text).join("");
const normal = (text: string) =>
  text
    .trim()
    .replace(/[:.]+$/, "")
    .toLocaleLowerCase();

interface Part {
  title: string;
  level: number;
  blocks: Block[];
}

/** Cuts blocks at every heading of `level`: the text under each one, up to the next. */
function partsAt(blocks: Block[], level: number): Part[] {
  const parts: Part[] = [];
  for (const b of blocks) {
    if (b.type === "heading" && b.level <= level)
      parts.push({ title: plain(b.runs), level: b.level, blocks: [] });
    else parts.at(-1)?.blocks.push(b);
  }
  return parts.filter((p) => p.level === level);
}

function topLevel(blocks: Block[]): number | null {
  const levels = blocks.flatMap((b) => (b.type === "heading" ? [b.level] : []));
  return levels.length ? Math.min(...levels) : null;
}

/** The items of every list in these blocks: the points on a slide. */
const listItems = (blocks: Block[]) =>
  blocks.flatMap((b) => (b.type === "list" ? b.items.map(plain) : []));
const paragraphs = (blocks: Block[]) =>
  blocks.flatMap((b) => (b.type === "paragraph" ? [plain(b.runs)] : []));

/** Everything in these blocks as plain text, for the speaker notes. */
function noteOf(b: Block): string {
  if (b.type === "heading" || b.type === "paragraph") return plain(b.runs);
  if (b.type === "list") return "";
  if (b.type === "table")
    return [b.header, ...b.rows].map((row) => row.map(plain).join(" · ")).join("\n");
  return b.text;
}

/** The notes: the teacher's text of a part, without the lists already on the slide. */
const notesOf = (blocks: Block[]) =>
  blocks
    .map(noteOf)
    .filter((t) => t)
    .join("\n\n");

/** One slide, or more when it has more than `MAX_POINTS` points; each part keeps the notes. */
function slides(title: string, points: string[], notes: string, locale: Locale): Slide[] {
  const out: Slide[] = [{ title, points: points.slice(0, MAX_POINTS), notes }];
  for (let i = MAX_POINTS; i < points.length; i += MAX_POINTS)
    out.push({
      title: `${title} ${loc(CONTINUED, locale)}`,
      points: points.slice(i, i + MAX_POINTS),
      notes,
    });
  return out;
}

function deckOf(blocks: Block[], headings: SlideHeadings, locale: Locale): Slide[] {
  const level = topLevel(blocks);
  if (level === null) return [];
  const part = (name: string) =>
    partsAt(blocks, level).find((p) => normal(p.title) === normal(name));
  const out: Slide[] = [];

  const opening = part(headings.opening);
  if (opening) {
    const points = [...paragraphs(opening.blocks), ...listItems(opening.blocks)];
    out.push(...slides(opening.title, points, "", locale));
  }

  const outline = part(headings.phases);
  if (outline) {
    const sub = topLevel(outline.blocks);
    for (const phase of sub === null ? [] : partsAt(outline.blocks, sub))
      out.push(...slides(phase.title, listItems(phase.blocks), notesOf(phase.blocks), locale));
  }

  const closing = part(headings.closing);
  if (closing) {
    const items = listItems(closing.blocks);
    const points = items.length ? items : paragraphs(closing.blocks);
    out.push(...slides(closing.title, points, "", locale));
  }
  return out;
}

/** The deck of an export: the slides of its `slides` steps, in order. */
export function toSlideDeck(doc: ExportDoc): SlideDeck {
  return {
    title: doc.title,
    locale: doc.locale,
    slides: doc.sections.flatMap((s) =>
      s.kind === "slides" && s.slides ? deckOf(s.blocks, s.slides, doc.locale) : [],
    ),
  };
}
