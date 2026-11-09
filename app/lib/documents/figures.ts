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
 * - PDF: embedded images are often split, masked or vector, so a page that
 *   draws a figure-sized image is offered as a picture of the whole page.
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
/** Long edge of a rendered PDF page; the model scales larger images down anyway. */
const PAGE_WIDTH = 1200;
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

/** The browser-only steps, injectable so tests need no canvas. */
export interface FigureDeps {
  /** Draws one PDF page as a `data:` URL. */
  renderPdfPage: (pdf: PdfProxy, pageNumber: number) => Promise<string>;
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

/** Pages that draw at least one figure-sized image, from a loaded PDF. */
async function figurePagesOf(pdf: PdfProxy): Promise<number[]> {
  const { getResolvedPDFJS } = await import("unpdf");
  const { OPS } = await getResolvedPDFJS();
  const pages: number[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const { fnArray, argsArray } = await page.getOperatorList();
    let ctm: Matrix = [1, 0, 0, 1, 0, 0];
    const stack: Matrix[] = [];
    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      const args = argsArray[i];
      if (fn === OPS.save) stack.push(ctm);
      else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
      else if (fn === OPS.transform) ctm = multiply(ctm, args as Matrix);
      else if (fn === OPS.paintFormXObjectBegin) {
        stack.push(ctm);
        if (Array.isArray(args?.[0]) && args[0].length === 6)
          ctm = multiply(ctm, args[0] as Matrix);
      } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
      else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        // An image fills the unit square, so the CTM's column lengths are its drawn size.
        const w = Math.hypot(ctm[0], ctm[1]);
        const h = Math.hypot(ctm[2], ctm[3]);
        if (isFigure(w, h)) {
          pages.push(p);
          break;
        }
      }
    }
  }
  return pages;
}

/** The pages of a PDF that draw a figure-sized image (1-based). */
export async function pdfFigurePages(bytes: Uint8Array): Promise<number[]> {
  const { getDocumentProxy } = await import("unpdf");
  return figurePagesOf(await getDocumentProxy(bytes));
}

function fromDataUrl(url: string): ImageInput {
  const match = /^data:(image\/[a-z]+);base64,(.*)$/s.exec(url);
  if (!match) throw new Error("not an image data URL");
  return { mediaType: match[1] ?? "", dataBase64: match[2] ?? "" };
}

/** Browser defaults: unpdf draws the page, a canvas shrinks a large photo. */
const browserFigureDeps: FigureDeps = {
  renderPdfPage: async (pdf, pageNumber) => {
    const { renderPageAsImage } = await import("unpdf");
    return renderPageAsImage(pdf, pageNumber, { width: PAGE_WIDTH, toDataURL: true });
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
        for (const page of await figurePagesOf(pdf)) {
          if (figures.length >= MAX_FIGURE_CANDIDATES) break;
          add(file.name, fromDataUrl(await deps.renderPdfPage(pdf, page)), page);
        }
      }
    } catch {
      // Unreadable file: no figures from it.
    }
  }
  return { figures, unsupported };
}
