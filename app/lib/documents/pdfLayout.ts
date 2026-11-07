/**
 * Where text sits on a drawn PDF page (24.0c). Pure and browser-free: the
 * loader hands over pdf.js text items and the page box; the viewer gets the
 * page text (identical to the text extraction, so search offsets line up) and
 * each item's place as fractions of the page, top-left origin. That lets the
 * viewer mark a found passage on the page image itself and scroll to it.
 */

/** A pdf.js text item, as `unpdf`'s `extractTextItems` returns it (PDF space). */
export interface PdfTextItem {
  str: string;
  /** Baseline start, PDF user space (y goes up). */
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  hasEOL: boolean;
}

export interface PlacedItem {
  /** Offsets into the page text. */
  start: number;
  end: number;
  /** Fractions of the page width/height, from the top left. */
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PageLayout {
  text: string;
  /** Page width divided by its height. */
  aspect: number;
  items: PlacedItem[];
}

export type Rect = Pick<PlacedItem, "left" | "top" | "width" | "height">;

/** How far below the baseline a mark reaches, as a share of the font size. */
const DESCENT = 0.25;

/** `viewBox` is the page box `[x0, y0, x1, y1]` (pdf.js `viewport.viewBox`). */
export function pageLayout(items: PdfTextItem[], viewBox: number[]): PageLayout {
  const [x0, y0, x1, y1] = viewBox;
  const pageW = x1 - x0 || 1;
  const pageH = y1 - y0 || 1;
  let text = "";
  const placed: PlacedItem[] = [];
  for (const item of items) {
    const start = text.length;
    text += item.str;
    if (item.str) {
      const h = item.fontSize || item.height;
      placed.push({
        start,
        end: text.length,
        left: (item.x - x0) / pageW,
        top: (y1 - item.y - h) / pageH,
        width: item.width / pageW,
        // From the top of the capitals down past the baseline, so descenders show.
        height: (h * (1 + DESCENT)) / pageH,
      });
    }
    if (item.hasEOL) text += "\n";
  }
  return { text, aspect: pageW / pageH, items: placed };
}

/** The rectangles that cover the text from `start` to `end` (offsets into the page text). */
export function highlightRects(layout: PageLayout, start: number, end: number): Rect[] {
  const rects: Rect[] = [];
  for (const item of layout.items) {
    const from = Math.max(start, item.start);
    const to = Math.min(end, item.end);
    if (from >= to) continue;
    const length = item.end - item.start;
    rects.push({
      left: item.left + item.width * ((from - item.start) / length),
      top: item.top,
      width: item.width * ((to - from) / length),
      height: item.height,
    });
  }
  return rects;
}

const STEP = 256;
const MIN_WIDTH = 512;
const MAX_WIDTH = 4096;
const UNMEASURED_WIDTH = 1024;

/**
 * How many pixels wide to draw a page that shows `cssWidth` wide on a screen
 * with `pixelRatio`: sharp at any zoom, in coarse steps so a small resize does
 * not redraw, and capped so a big zoom does not exhaust memory.
 */
export function renderWidth(cssWidth: number, pixelRatio: number): number {
  if (!(cssWidth > 0)) return UNMEASURED_WIDTH;
  const wanted = Math.ceil((cssWidth * (pixelRatio || 1)) / STEP) * STEP;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, wanted));
}
