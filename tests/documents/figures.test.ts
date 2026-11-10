// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  documentFigures,
  docxFigures,
  imageSize,
  MAX_FIGURE_CANDIDATES,
  type FigureDeps,
} from "~/lib/documents/figures";
import { type FigureBox, pdfFigureBoxes } from "~/lib/documents/pdfFigures";
import { DOCX_MIME, PDF_MIME } from "~/lib/documents/extract";

const bytesOf = (name: string) =>
  new Uint8Array(readFileSync(resolve(__dirname, "../fixtures", name)));
const fileOf = (name: string, type: string) => new File([bytesOf(name)], name, { type });

/** Browser-only steps stubbed: no canvas in tests. */
const deps: FigureDeps = {
  renderPdfFigure: vi.fn(async (_pdf, page: number) => `data:image/png;base64,UEFHRS${page}`),
  shrink: async (image) => image,
};

/** A box (fractions of the page, top-left origin) around a figure drawn in PDF points. */
const PAGE = { width: 612, height: 792 };
function expectAround(box: FigureBox | undefined, x: number, y: number, w: number, h: number) {
  expect(box).toBeDefined();
  const b = box as FigureBox;
  const want = {
    left: x / PAGE.width,
    top: (PAGE.height - y - h) / PAGE.height,
    right: (x + w) / PAGE.width,
    bottom: (PAGE.height - y) / PAGE.height,
  };
  // The cut-out holds the whole figure plus a small margin, never much more.
  const margin = 0.03;
  expect(b.x).toBeLessThanOrEqual(want.left);
  expect(b.x).toBeGreaterThanOrEqual(want.left - margin);
  expect(b.y).toBeLessThanOrEqual(want.top);
  expect(b.y).toBeGreaterThanOrEqual(want.top - margin);
  expect(b.x + b.width).toBeGreaterThanOrEqual(want.right);
  expect(b.x + b.width).toBeLessThanOrEqual(want.right + margin);
  expect(b.y + b.height).toBeGreaterThanOrEqual(want.bottom);
  expect(b.y + b.height).toBeLessThanOrEqual(want.bottom + margin);
}

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

  it("counts the charts and SmartArt diagrams Word draws itself, which hold no image", async () => {
    const { drawings } = await docxFigures(bytesOf("sample-images.docx"));
    expect(drawings).toBe(2);
  });

  it("finds nothing in a Word file without images", async () => {
    expect(await docxFigures(bytesOf("sample.docx"))).toEqual({
      images: [],
      unsupported: 0,
      drawings: 0,
    });
  });
});

describe("pdfFigureBoxes", () => {
  it("cuts out the figure, not a page with only a small logo", async () => {
    const found = await pdfFigureBoxes(bytesOf("sample-images.pdf"));
    expect(found.map((f) => f.page)).toEqual([2]);
    expectAround(found[0]?.box, 72, 400, 300, 200);
  });

  it("finds no figures in a text-only PDF", async () => {
    expect(await pdfFigureBoxes(bytesOf("sample.pdf"))).toEqual([]);
  });

  it("skips a banner on every page and a scanned page, and cuts out each real figure", async () => {
    const found = await pdfFigureBoxes(bytesOf("sample-figure-noise.pdf"));
    expect(found.map((f) => f.page)).toEqual([3, 4, 4]);
    // Two stacked tiles make one figure.
    expectAround(found[0]?.box, 72, 300, 300, 200);
    // Top of the page first.
    expectAround(found[1]?.box, 340, 450, 200, 150);
    expectAround(found[2]?.box, 72, 100, 200, 150);
  });

  it("cuts out charts and diagrams drawn as vectors, with their labels", async () => {
    const found = await pdfFigureBoxes(bytesOf("sample-vector-figures.pdf"));
    expect(found.map((f) => f.page)).toEqual([1, 2, 3]);
    // Bar chart: axes, bars and the labels below the axis.
    expectAround(found[0]?.box, 100, 462, 300, 188);
    // Flowchart: three boxes joined by lines.
    expectAround(found[1]?.box, 72, 300, 400, 50);
    // Line chart with its axis label.
    expectAround(found[2]?.box, 100, 185, 300, 215);
  });
});

describe("documentFigures", () => {
  it("offers Word figures and cut-out PDF figures, each with its source", async () => {
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
    const [, page, box] = vi.mocked(deps.renderPdfFigure).mock.lastCall ?? [];
    expect(page).toBe(2);
    expectAround(box, 72, 400, 300, 200);
  });

  it("offers every figure of a page apart, and no noise", async () => {
    const { figures } = await documentFigures([fileOf("sample-figure-noise.pdf", PDF_MIME)], deps);
    expect(figures.map((f) => ({ page: f.page, index: f.index }))).toEqual([
      { page: 3, index: 1 },
      { page: 4, index: 2 },
      { page: 4, index: 3 },
    ]);
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
