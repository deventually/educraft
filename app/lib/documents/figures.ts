/**
 * Figures from an uploaded PDF/Word document, offered to the teacher as images
 * the model may see (stage assessment: architecture sketches, ERDs, wireframes).
 *
 * Everything runs in the browser on the `File` in memory; nothing is uploaded
 * until the teacher ticks a figure and sends. Anonymisation covers text only,
 * so figures are an explicit opt-in per image (see DocumentFigurePicker).
 *
 * - Word: the embedded images mammoth sees. Formats the model cannot read
 *   (EMF/WMF from Visio, TIFF, SVG) are counted, not offered. Icons are dropped.
 * - PDF: each figure-sized image is cut out of the drawn page, so masks and
 *   overlays show as the reader sees them. Tiles of one figure merge into one.
 *   Not a figure: an image on the same spot of three or more pages (a banner,
 *   logo or page background) and one that covers a page with text (a scan).
 */
import type { ImageInput } from "~/lib/ai/types";
import type { getDocumentProxy } from "unpdf";
import { DOCX_MIME, PDF_MIME } from "./extract";

type PdfProxy = Awaited<ReturnType<typeof getDocumentProxy>>;

/** At most this many figures are offered, so a huge portfolio stays fast. */
export const MAX_FIGURE_CANDIDATES = 30;

/** Smaller than this (pixels in Word, points in a PDF) is an icon or a logo. */
const MIN_SIDE = 72;
const MIN_AREA = 100 * 100;
/** Width a figure is cut out at; the model scales larger images down anyway. */
const FIGURE_WIDTH = 1200;
/** A rendered page is never wider than this, however small the figure. */
const MAX_PAGE_WIDTH = 2400;
/** Margin around a cut-out figure, as a fraction of the page. */
const MARGIN = 0.015;
/** An image on the same spot of this many pages is page furniture. */
const REPEATS = 3;
/** An image covering this much of a page with text is a scan or a background. */
const COVERS_PAGE = 0.8;
/** Image types the model reads (mirrors ImageInputSchema in /api/stream). */
const MODEL_IMAGE = /^image\/(png|jpeg|gif|webp)$/;

export interface DocFigure {
  /** File name the figure comes from. */
  source: string;
  /** PDF page (1-based); undefined for a Word image. */
  page?: number;
  /** 1-based position in the offer, for a stable label. */
  index: number;
  image: ImageInput;
}

export interface DocFigures {
  figures: DocFigure[];
  /** Images in a format the model cannot read (e.g. a Visio drawing as EMF). */
  unsupported: number;
}

/** Part of a page, as fractions of its width and height, from the top left. */
export interface FigureBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The browser-only steps, injectable so tests need no canvas. */
export interface FigureDeps {
  /** Draws one part of a PDF page as a `data:` URL. */
  renderPdfFigure: (pdf: PdfProxy, pageNumber: number, box: FigureBox) => Promise<string>;
  /** Scales a large photo down before it is offered. */
  shrink: (image: ImageInput) => Promise<ImageInput>;
}

const isFigure = (w: number, h: number) => Math.min(w, h) >= MIN_SIDE && w * h >= MIN_AREA;

/** Pixel size from a PNG, GIF, JPEG or WebP header; undefined when unknown. */
export function imageSize(b: Uint8Array): { width: number; height: number } | undefined {
  /** Out of range reads as 0, as a bitwise op on a missing byte did before. */
  const at = (i: number) => b[i] ?? 0;
  const u16be = (i: number) => (at(i) << 8) | at(i + 1);
  const u16le = (i: number) => at(i) | (at(i + 1) << 8);
  const u32be = (i: number) =>
    ((at(i) << 24) | (at(i + 1) << 16) | (at(i + 2) << 8) | at(i + 3)) >>> 0;
  if (b.length >= 24 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) {
    return { width: u32be(16), height: u32be(20) };
  }
  if (b.length >= 10 && at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46) {
    return { width: u16le(6), height: u16le(8) };
  }
  if (b.length >= 30 && at(0) === 0x52 && at(1) === 0x49 && at(8) === 0x57 && at(9) === 0x45) {
    const kind = String.fromCharCode(at(12), at(13), at(14), at(15));
    if (kind === "VP8 ") return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    if (kind === "VP8L") {
      const bits = at(21) | (at(22) << 8) | (at(23) << 16) | (at(24) << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === "VP8X") {
      return {
        width: 1 + (at(24) | (at(25) << 8) | (at(26) << 16)),
        height: 1 + (at(27) | (at(28) << 8) | (at(29) << 16)),
      };
    }
    return undefined;
  }
  if (b.length >= 4 && at(0) === 0xff && at(1) === 0xd8) {
    let i = 2;
    while (i + 8 < b.length) {
      if (at(i) !== 0xff) return undefined;
      const marker = at(i + 1);
      // SOF0..SOF15, except DHT (C4), JPG (C8) and DAC (CC), carry the size.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: u16be(i + 7), height: u16be(i + 5) };
      }
      i += 2 + u16be(i + 2);
    }
  }
  return undefined;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The figure-sized images of a Word file, in document order. */
export async function docxFigures(
  bytes: Uint8Array,
): Promise<{ images: ImageInput[]; unsupported: number }> {
  const mammoth = (await import("mammoth")).default;
  const images: ImageInput[] = [];
  let unsupported = 0;
  const convertImage = mammoth.images.imgElement(async (image) => {
    const contentType = image.contentType.toLowerCase();
    if (!MODEL_IMAGE.test(contentType)) {
      unsupported++;
      return { src: "" };
    }
    const dataBase64 = await image.readAsBase64String();
    const size = imageSize(base64ToBytes(dataBase64.slice(0, 64 * 1024)));
    if (size && isFigure(size.width, size.height)) {
      images.push({ mediaType: contentType, dataBase64 });
    }
    return { src: "" };
  });
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  // Node build reads `buffer`, browser build reads `arrayBuffer` — pass both.
  await mammoth.convertToHtml(
    { buffer: bytes, arrayBuffer } as Parameters<typeof mammoth.convertToHtml>[0],
    { convertImage },
  );
  return { images, unsupported };
}

type Matrix = [number, number, number, number, number, number];
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const overlaps = (a: FigureBox, b: FigureBox) =>
  a.x <= b.x + b.width + MARGIN &&
  b.x <= a.x + a.width + MARGIN &&
  a.y <= b.y + b.height + MARGIN &&
  b.y <= a.y + a.height + MARGIN;

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

/** Touching or overlapping boxes become one: the tiles of a split image. */
function merge(boxes: FigureBox[]): FigureBox[] {
  const out = [...boxes];
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      if (overlaps(out[i] as FigureBox, out[j] as FigureBox)) {
        out[i] = union(out[i] as FigureBox, out[j] as FigureBox);
        out.splice(j, 1);
        j = i;
      }
    }
  }
  return out;
}

/** Same spot on the page, give or take a percent: how a repeated banner is recognised. */
const spot = (b: FigureBox) =>
  [b.x, b.y, b.width, b.height].map((n) => Math.round(n * 100)).join(",");

interface PageImages {
  page: number;
  boxes: FigureBox[];
  hasText: boolean;
}

/** Every figure-sized image a page draws, as a box on that page. */
async function imagesOfPage(pdf: PdfProxy, p: number, OPS: Record<string, number>) {
  const page = await pdf.getPage(p);
  const viewport = page.getViewport({ scale: 1 });
  const { fnArray, argsArray } = await page.getOperatorList();
  const boxes: FigureBox[] = [];
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
      // The image's corners on the page as the reader sees it (rotation included).
      const corners = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map(([u = 0, v = 0]) => {
        const [x = 0, y = 0] = viewport.convertToViewportPoint(
          ctm[0] * u + ctm[2] * v + ctm[4],
          ctm[1] * u + ctm[3] * v + ctm[5],
        ) as number[];
        return { x: x / viewport.width, y: y / viewport.height };
      });
      const left = Math.max(0, Math.min(...corners.map((c) => c.x)));
      const top = Math.max(0, Math.min(...corners.map((c) => c.y)));
      const right = Math.min(1, Math.max(...corners.map((c) => c.x)));
      const bottom = Math.min(1, Math.max(...corners.map((c) => c.y)));
      if (right > left && bottom > top)
        boxes.push({ x: left, y: top, width: right - left, height: bottom - top });
    }
  }
  return { page: p, boxes, hasText };
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
async function figureBoxesOf(pdf: PdfProxy): Promise<{ page: number; box: FigureBox }[]> {
  const { getResolvedPDFJS } = await import("unpdf");
  const { OPS } = await getResolvedPDFJS();
  const pages: PageImages[] = [];
  for (let p = 1; p <= pdf.numPages; p++) pages.push(await imagesOfPage(pdf, p, OPS));

  const seen = new Map<string, Set<number>>();
  for (const { page, boxes } of pages)
    for (const box of boxes) seen.set(spot(box), (seen.get(spot(box)) ?? new Set()).add(page));
  const furniture = (box: FigureBox) => (seen.get(spot(box))?.size ?? 0) >= REPEATS;
  const scan = (box: FigureBox, hasText: boolean) =>
    hasText && box.width * box.height >= COVERS_PAGE;

  return pages.flatMap(({ page, boxes, hasText }) =>
    merge(boxes.filter((b) => !furniture(b) && !scan(b, hasText)))
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((box) => ({ page, box: pad(box) })),
  );
}

/** The figures of a PDF: the page (1-based) and where on it each one sits. */
export async function pdfFigureBoxes(bytes: Uint8Array) {
  const { getDocumentProxy } = await import("unpdf");
  return figureBoxesOf(await getDocumentProxy(bytes));
}

function fromDataUrl(url: string): ImageInput {
  const match = /^data:(image\/[a-z]+);base64,(.*)$/s.exec(url);
  if (!match) throw new Error("not an image data URL");
  return { mediaType: match[1] ?? "", dataBase64: match[2] ?? "" };
}

/** Browser defaults: unpdf draws the page, a canvas shrinks a large photo. */
const browserFigureDeps: FigureDeps = {
  renderPdfFigure: async (pdf, pageNumber, box) => {
    const { renderPageAsImage } = await import("unpdf");
    const width = Math.min(MAX_PAGE_WIDTH, Math.round(FIGURE_WIDTH / box.width));
    const page = await renderPageAsImage(pdf, pageNumber, { width, toDataURL: true });
    // An <img>, not fetch(): the CSP allows data: images but no data: connections.
    const img = new Image();
    img.src = page;
    await img.decode();
    const sx = Math.round(box.x * img.naturalWidth);
    const sy = Math.round(box.y * img.naturalHeight);
    const sw = Math.max(1, Math.round(box.width * img.naturalWidth));
    const sh = Math.max(1, Math.round(box.height * img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    canvas.getContext("2d")?.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL("image/png");
  },
  shrink: async (image) => {
    const { fileToImageInput } = await import("~/lib/images/process");
    const blob = new Blob([base64ToBytes(image.dataBase64) as BlobPart], { type: image.mediaType });
    return fileToImageInput(new File([blob], "figure", { type: image.mediaType }));
  },
};

/**
 * The figures of the uploaded files, in upload order, capped at
 * MAX_FIGURE_CANDIDATES. A file that cannot be read offers nothing rather than
 * failing: the text extraction already reports a broken file.
 */
export async function documentFigures(
  files: File[],
  deps: FigureDeps = browserFigureDeps,
): Promise<DocFigures> {
  const figures: DocFigure[] = [];
  let unsupported = 0;
  const add = (source: string, image: ImageInput, page?: number) =>
    figures.push({ source, page, index: figures.length + 1, image });

  for (const file of files) {
    if (figures.length >= MAX_FIGURE_CANDIDATES) break;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (file.type === DOCX_MIME) {
        const found = await docxFigures(bytes);
        unsupported += found.unsupported;
        for (const image of found.images) {
          if (figures.length >= MAX_FIGURE_CANDIDATES) break;
          add(file.name, await deps.shrink(image));
        }
      } else if (file.type === PDF_MIME) {
        const { getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(bytes);
        for (const { page, box } of await figureBoxesOf(pdf)) {
          if (figures.length >= MAX_FIGURE_CANDIDATES) break;
          const image = fromDataUrl(await deps.renderPdfFigure(pdf, page, box));
          add(file.name, await deps.shrink(image), page);
        }
      }
    } catch {
      // Unreadable file: no figures from it.
    }
  }
  return { figures, unsupported };
}
