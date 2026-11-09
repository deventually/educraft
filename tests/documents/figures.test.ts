// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  documentFigures,
  docxFigures,
  imageSize,
  MAX_FIGURE_CANDIDATES,
  pdfFigurePages,
  type FigureDeps,
} from "~/lib/documents/figures";
import { DOCX_MIME, PDF_MIME } from "~/lib/documents/extract";

const bytesOf = (name: string) =>
  new Uint8Array(readFileSync(resolve(__dirname, "../fixtures", name)));
const fileOf = (name: string, type: string) => new File([bytesOf(name)], name, { type });

/** Browser-only steps stubbed: no canvas in tests. */
const deps: FigureDeps = {
  renderPdfPage: vi.fn(async (_pdf, page: number) => `data:image/png;base64,UEFHRS${page}`),
  shrink: async (image) => image,
};

describe("imageSize", () => {
  it("reads the pixel size from a PNG header", () => {
    const docx = bytesOf("sample-images.docx");
    // The 200 × 150 figure PNG sits stored (uncompressed) inside the fixture zip.
    const at = Buffer.from(docx).indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(imageSize(docx.subarray(at))).toEqual({ width: 200, height: 150 });
  });

  it("reads the pixel size from a JPEG header", () => {
    // SOI, APP0 (len 16), SOF0 with height 300 and width 400.
    const jpeg = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe0,
      0x00,
      0x10,
      ...new Array(14).fill(0),
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      0x01,
      0x2c,
      0x01,
      0x90,
    ]);
    expect(imageSize(jpeg)).toEqual({ width: 400, height: 300 });
  });

  it("knows no size for bytes it cannot read", () => {
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeUndefined();
  });
});

describe("docxFigures", () => {
  it("keeps a real figure, drops a tiny icon and counts a format the model cannot read", async () => {
    const { images, unsupported } = await docxFigures(bytesOf("sample-images.docx"));
    expect(images).toHaveLength(1);
    expect(images[0]!.mediaType).toBe("image/png");
    expect(images[0]!.dataBase64).toMatch(/^iVBORw0KGgo/);
    expect(unsupported).toBe(1);
  });

  it("finds nothing in a Word file without images", async () => {
    expect(await docxFigures(bytesOf("sample.docx"))).toEqual({ images: [], unsupported: 0 });
  });
});

describe("pdfFigurePages", () => {
  it("names the pages with a figure, not a page with only a small logo", async () => {
    expect(await pdfFigurePages(bytesOf("sample-images.pdf"))).toEqual([2]);
  });

  it("finds no figure pages in a text-only PDF", async () => {
    expect(await pdfFigurePages(bytesOf("sample.pdf"))).toEqual([]);
  });
});

describe("documentFigures", () => {
  it("offers Word figures and PDF figure pages, each with its source", async () => {
    const { figures, unsupported } = await documentFigures(
      [fileOf("sample-images.docx", DOCX_MIME), fileOf("sample-images.pdf", PDF_MIME)],
      deps,
    );
    expect(figures.map((f) => ({ source: f.source, page: f.page, index: f.index }))).toEqual([
      { source: "sample-images.docx", page: undefined, index: 1 },
      { source: "sample-images.pdf", page: 2, index: 2 },
    ]);
    expect(figures[1]!.image).toEqual({ mediaType: "image/png", dataBase64: "UEFHRS2" });
    expect(unsupported).toBe(1);
  });

  it("offers nothing for a file without figures", async () => {
    const { figures } = await documentFigures([fileOf("sample.pdf", PDF_MIME)], deps);
    expect(figures).toEqual([]);
  });

  it("caps the offer, so a huge portfolio does not render every page", async () => {
    const many = Array.from(
      { length: MAX_FIGURE_CANDIDATES + 5 },
      (_, i) => new File([bytesOf("sample-images.docx")], `v${i}.docx`, { type: DOCX_MIME }),
    );
    const { figures } = await documentFigures(many, deps);
    expect(figures).toHaveLength(MAX_FIGURE_CANDIDATES);
  });
});
