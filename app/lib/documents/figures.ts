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
 *   Charts, SmartArt and drawn diagrams hold no image (Word draws them), so they
 *   are counted too: saved as PDF, they come along as vector figures.
 * - PDF: each figure, an image or a vector drawing such as a chart or diagram, is
 *   cut out of the drawn page, so masks, overlays and labels show as the reader
 *   sees them. Where the figures sit is pdfFigures.ts.
 */
import type { ImageInput } from "~/lib/ai/types";
import { DOCX_MIME, PDF_MIME } from "./extract";
import { type FigureBox, figureBoxesOf, isFigure, type PdfProxy } from "./pdfFigures";

/** At most this many figures are offered, so a huge portfolio stays fast. */
export const MAX_FIGURE_CANDIDATES = 30;

/** Width a figure is cut out at; the model scales larger images down anyway. */
const FIGURE_WIDTH = 1200;
/** A rendered page is never wider than this, however small the figure. */
const MAX_PAGE_WIDTH = 2400;
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
  /** Charts and diagrams Word draws itself; only a PDF of the file carries them. */
  drawings: number;
}

/** The browser-only steps, injectable so tests need no canvas. */
export interface FigureDeps {
  /** Draws one part of a PDF page as a `data:` URL. */
  renderPdfFigure: (pdf: PdfProxy, pageNumber: number, box: FigureBox) => Promise<string>;
  /** Scales a large photo down before it is offered. */
  shrink: (image: ImageInput) => Promise<ImageInput>;
}

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

/** What Word draws itself: a chart, a SmartArt diagram, a drawing canvas or a group of shapes. */
const WORD_DRAWING =
  /<(?:\w+:)?graphicData\b[^>]*\buri="[^"]*\/(?:chart|chartex|diagram|wordprocessingCanvas|wordprocessingGroup)"/g;

/** The charts and diagrams in a Word file's body, which mammoth cannot turn into images. */
async function wordDrawings(bytes: Uint8Array): Promise<number> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  return xml.match(WORD_DRAWING)?.length ?? 0;
}

/** The figure-sized images of a Word file, in document order. */
export async function docxFigures(
  bytes: Uint8Array,
): Promise<{ images: ImageInput[]; unsupported: number; drawings: number }> {
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
  return { images, unsupported, drawings: await wordDrawings(bytes) };
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
  let drawings = 0;
  const add = (source: string, image: ImageInput, page?: number) =>
    figures.push({ source, page, index: figures.length + 1, image });

  for (const file of files) {
    if (figures.length >= MAX_FIGURE_CANDIDATES) break;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (file.type === DOCX_MIME) {
        const found = await docxFigures(bytes);
        unsupported += found.unsupported;
        drawings += found.drawings;
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
  return { figures, unsupported, drawings };
}
