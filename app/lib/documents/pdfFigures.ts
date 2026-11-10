/**
 * Where the figures of a PDF sit, page by page (see figures.ts for the offer).
 *
 * A figure is either an embedded image or a vector drawing: a chart, diagram or
 * flowchart as Word, Excel, PowerPoint, draw.io and Visio export it, made of paths
 * and text. Not a figure:
 * - something on the same spot of three or more pages (a banner, logo or header);
 * - an image covering a page with text (a scan), a path covering a page (a border);
 * - lines only (a table grid, an underline, a header rule) or one plain box (a framed
 *   text); a filled box with text in it is cell shading or a highlight, not a shape.
 * A vector figure takes along the text right beside it: its labels and axis titles.
 */
import type { getDocumentProxy } from "unpdf";

export type PdfProxy = Awaited<ReturnType<typeof getDocumentProxy>>;

/** Part of a page, as fractions of its width and height, from the top left. */
export interface FigureBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Smaller than this (points) is an icon or a logo. */
const MIN_SIDE = 72;
const MIN_AREA = 100 * 100;
/** Margin around a cut-out figure, as a fraction of the page. */
const MARGIN = 0.015;
/** Something on the same spot of this many pages is page furniture. */
const REPEATS = 3;
/** An image covering this much of a page with text is a scan or a background. */
const COVERS_PAGE = 0.8;
/** A path thinner than this (points) is a line: a rule, underline or table border. */
const RULE = 3;
/** Paths this close (fraction of the page) belong to one drawing. */
const GAP = 0.02;
/** Text this close to a drawing is its label. */
const LABEL_GAP = 0.015;
/** Path segment codes inside `constructPath` (pdf.js DrawOPS, not exported). */
const LINE_TO = 1;
const CURVE_TO = 2;
const QUADRATIC_CURVE_TO = 3;

export const isFigure = (w: number, h: number) => Math.min(w, h) >= MIN_SIDE && w * h >= MIN_AREA;
/** A drawing may be wide and low, like a flowchart in one row. */
const isDrawing = (w: number, h: number) => Math.min(w, h) >= MIN_SIDE / 2 && w * h >= MIN_AREA;

type Matrix = [number, number, number, number, number, number];
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const near = (a: FigureBox, b: FigureBox, gap: number) =>
  a.x <= b.x + b.width + gap &&
  b.x <= a.x + a.width + gap &&
  a.y <= b.y + b.height + gap &&
  b.y <= a.y + a.height + gap;

const union = (a: FigureBox, b: FigureBox): FigureBox => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

/** Boxes within `gap` of each other become groups, each with its members. */
function group<T extends { box: FigureBox }>(items: T[], gap: number) {
  const groups = items.map((item) => ({ box: item.box, members: [item] }));
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const [a, b] = [groups[i], groups[j]];
      if (a && b && near(a.box, b.box, gap)) {
        groups[i] = { box: union(a.box, b.box), members: [...a.members, ...b.members] };
        groups.splice(j, 1);
        j = i;
      }
    }
  }
  return groups;
}

/** Touching or overlapping boxes become one: the tiles of a split image. */
const merge = (boxes: FigureBox[]) =>
  group(
    boxes.map((box) => ({ box })),
    MARGIN,
  ).map((g) => g.box);

/** Same spot on the page, give or take a percent: how repeated furniture is recognised. */
const spot = (b: FigureBox) =>
  [b.x, b.y, b.width, b.height].map((n) => Math.round(n * 100)).join(",");

const area = (b: FigureBox) => b.width * b.height;
const inside = (b: FigureBox, x: number, y: number) =>
  x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;

interface Shape {
  box: FigureBox;
  /** A line: a rule, underline or border, not a shape of its own. */
  rule: boolean;
  /** At most four straight sides: a box. */
  plain: boolean;
  /** Filled, not outlined: with text in it, it is shading or a highlight. */
  filledOnly: boolean;
}

interface PageContent {
  page: number;
  images: FigureBox[];
  shapes: Shape[];
  hasText: boolean;
  /** Points per page fraction, to measure in points. */
  width: number;
  height: number;
  textBoxes: () => Promise<FigureBox[]>;
}

/** Everything a page draws that may be (part of) a figure, as boxes on that page. */
async function contentOfPage(pdf: PdfProxy, p: number, OPS: Record<string, number>) {
  const page = await pdf.getPage(p);
  const viewport = page.getViewport({ scale: 1 });
  const { fnArray, argsArray } = await page.getOperatorList();
  /** The box around points of the page, as the reader sees it (rotation included). */
  const boxOf = (points: number[][]): FigureBox | undefined => {
    const corners = points.map(([x = 0, y = 0]) => {
      const [vx = 0, vy = 0] = viewport.convertToViewportPoint(x, y) as number[];
      return { x: vx / viewport.width, y: vy / viewport.height };
    });
    const left = Math.max(0, Math.min(...corners.map((c) => c.x)));
    const top = Math.max(0, Math.min(...corners.map((c) => c.y)));
    const right = Math.min(1, Math.max(...corners.map((c) => c.x)));
    const bottom = Math.min(1, Math.max(...corners.map((c) => c.y)));
    return right >= left && bottom >= top
      ? { x: left, y: top, width: right - left, height: bottom - top }
      : undefined;
  };
  const apply = (m: Matrix, x: number, y: number) => [
    m[0] * x + m[2] * y + m[4],
    m[1] * x + m[3] * y + m[5],
  ];
  const images: FigureBox[] = [];
  const shapes: Shape[] = [];
  let hasText = false;
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = multiply(ctm, args as Matrix);
    else if (fn === OPS.showText) hasText = true;
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm);
      if (Array.isArray(args?.[0]) && args[0].length === 6) ctm = multiply(ctm, args[0] as Matrix);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      // An image fills the unit square, so the CTM's column lengths are its drawn size.
      if (!isFigure(Math.hypot(ctm[0], ctm[1]), Math.hypot(ctm[2], ctm[3]))) continue;
      const m = ctm;
      const box = boxOf([apply(m, 0, 0), apply(m, 1, 0), apply(m, 0, 1), apply(m, 1, 1)]);
      if (box && box.width > 0 && box.height > 0) images.push(box);
    } else if (fn === OPS.constructPath) {
      // [paint op, [segments], [minX, minY, maxX, maxY]]; a clip only (endPath) draws nothing.
      const [paint, segments, minMax] = (args ?? []) as [number, ArrayLike<number>[], number[]];
      const [x0 = Number.NaN, y0 = Number.NaN, x1 = Number.NaN, y1 = Number.NaN] = Array.from(
        minMax ?? [],
      );
      if (paint === OPS.endPath || ![x0, y0, x1, y1].every(Number.isFinite)) continue;
      const m = ctm;
      const box = boxOf([apply(m, x0, y0), apply(m, x1, y0), apply(m, x0, y1), apply(m, x1, y1)]);
      if (!box || area(box) >= COVERS_PAGE) continue;
      let sides = 0;
      let curved = false;
      for (const path of segments ?? [])
        for (const op of Array.from(path ?? []))
          if (op === LINE_TO) sides++;
          else if (op === CURVE_TO || op === QUADRATIC_CURVE_TO) curved = true;
      shapes.push({
        box,
        rule: Math.min(box.width * viewport.width, box.height * viewport.height) < RULE,
        plain: !curved && sides <= 4,
        filledOnly: paint === OPS.fill || paint === OPS.eoFill,
      });
    }
  }
  const textBoxes = async () => {
    const { items } = await page.getTextContent();
    return items.flatMap((item) => {
      if (!("transform" in item) || !item.str.trim()) return [];
      const [, , , , e = 0, f = 0] = item.transform as number[];
      const box = boxOf([
        [e, f],
        [e + item.width, f + item.height],
      ]);
      return box ? [box] : [];
    });
  };
  return {
    page: p,
    images,
    shapes,
    hasText,
    width: viewport.width,
    height: viewport.height,
    textBoxes,
  } satisfies PageContent;
}

/** The vector drawings of a page worth offering, each with its labels. */
async function drawingsOf(content: PageContent, furniture: (b: FigureBox) => boolean) {
  const groups = group(
    content.shapes.filter((s) => !furniture(s.box)),
    GAP,
  );
  if (groups.length === 0) return [];
  const texts = await content.textBoxes();
  const hasTextIn = (b: FigureBox) =>
    texts.some((t) => inside(b, t.x + t.width / 2, t.y + t.height / 2));
  return groups
    .filter((g) => {
      const shapes = g.members.filter((s) => !s.rule && !(s.filledOnly && hasTextIn(s.box)));
      return shapes.length >= 2 || shapes.some((s) => !s.plain);
    })
    .map((g) =>
      texts.filter((t) => t.width <= g.box.width && near(t, g.box, LABEL_GAP)).reduce(union, g.box),
    )
    .filter((b) => isDrawing(b.width * content.width, b.height * content.height));
}

const pad = (b: FigureBox): FigureBox => {
  const x = Math.max(0, b.x - MARGIN);
  const y = Math.max(0, b.y - MARGIN);
  return {
    x,
    y,
    width: Math.min(1, b.x + b.width + MARGIN) - x,
    height: Math.min(1, b.y + b.height + MARGIN) - y,
  };
};

/** The figures of a loaded PDF: per page, top to bottom, without page furniture. */
export async function figureBoxesOf(pdf: PdfProxy): Promise<{ page: number; box: FigureBox }[]> {
  const { getResolvedPDFJS } = await import("unpdf");
  const { OPS } = await getResolvedPDFJS();
  const contents: PageContent[] = [];
  for (let p = 1; p <= pdf.numPages; p++) contents.push(await contentOfPage(pdf, p, OPS));

  // Furniture is what repeats, image by image and path by path, before anything groups.
  const seen = new Map<string, Set<number>>();
  for (const { page, images, shapes } of contents)
    for (const box of [...images, ...shapes.map((s) => s.box)])
      seen.set(spot(box), (seen.get(spot(box)) ?? new Set()).add(page));
  const furniture = (box: FigureBox) => (seen.get(spot(box))?.size ?? 0) >= REPEATS;

  const figures: { page: number; box: FigureBox }[] = [];
  for (const content of contents) {
    const scan = (b: FigureBox) => content.hasText && area(b) >= COVERS_PAGE;
    const images = content.images.filter((b) => !furniture(b) && !scan(b));
    const boxes = merge([...images, ...(await drawingsOf(content, furniture))]);
    for (const box of boxes.sort((a, b) => a.y - b.y || a.x - b.x))
      figures.push({ page: content.page, box: pad(box) });
  }
  return figures;
}

/** The figures of a PDF: the page (1-based) and where on it each one sits. */
export async function pdfFigureBoxes(bytes: Uint8Array) {
  const { getDocumentProxy } = await import("unpdf");
  return figureBoxesOf(await getDocumentProxy(bytes));
}
