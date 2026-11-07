import { describe, expect, it } from "vitest";
import { highlightRects, pageLayout, renderWidth } from "~/lib/documents/pdfLayout";

/**
 * Where a hit sits on a drawn PDF page, so the viewer can mark the passage itself
 * and scroll to it, not just to the top of the page.
 */
describe("pageLayout", () => {
  // A 100 x 200 page with two lines; PDF space has y going up from the bottom.
  const items = [
    { str: "Hallo wereld", x: 10, y: 180, width: 60, height: 10, fontSize: 10, hasEOL: true },
    { str: "Tweede regel", x: 10, y: 160, width: 50, height: 10, fontSize: 10, hasEOL: false },
  ];
  const layout = pageLayout(items, [0, 0, 100, 200]);

  it("builds the same page text as the text extraction, with each item's offsets", () => {
    expect(layout.text).toBe("Hallo wereld\nTweede regel");
    expect(layout.items.map((i) => [i.start, i.end])).toEqual([
      [0, 12],
      [13, 25],
    ]);
  });

  it("places items as fractions of the page, from the top left", () => {
    expect(layout.aspect).toBe(0.5);
    const [first] = layout.items;
    expect(first.left).toBeCloseTo(0.1);
    expect(first.top).toBeCloseTo((200 - 180 - 10) / 200);
    expect(first.width).toBeCloseTo(0.6);
    // Down past the baseline, so a "g" or "p" is covered too.
    expect(first.height).toBeCloseTo(12.5 / 200);
  });

  it("respects a page box that does not start at the origin", () => {
    const shifted = pageLayout([{ ...items[0], x: 60, y: 230 }], [50, 50, 150, 250]);
    expect(shifted.items[0].left).toBeCloseTo(0.1);
    expect(shifted.items[0].top).toBeCloseTo((250 - 230 - 10) / 200);
  });

  it("skips an empty item but keeps its line break in the offsets", () => {
    const withBlank = pageLayout(
      [{ ...items[0], hasEOL: false }, { ...items[0], str: "", hasEOL: true }, items[1]],
      [0, 0, 100, 200],
    );
    expect(withBlank.text).toBe("Hallo wereld\nTweede regel");
    expect(withBlank.items).toHaveLength(2);
    expect(withBlank.items[1].start).toBe(13);
  });
});

describe("highlightRects", () => {
  const layout = pageLayout(
    [
      { str: "Hallo wereld", x: 10, y: 180, width: 60, height: 10, fontSize: 10, hasEOL: true },
      { str: "Tweede regel", x: 10, y: 160, width: 50, height: 10, fontSize: 10, hasEOL: false },
    ],
    [0, 0, 100, 200],
  );

  it("covers only the part of a line that is in the hit", () => {
    const rects = highlightRects(layout, 6, 12); // "wereld"
    expect(rects).toHaveLength(1);
    expect(rects[0].left).toBeCloseTo(0.1 + 0.6 * (6 / 12));
    expect(rects[0].width).toBeCloseTo(0.6 * (6 / 12));
  });

  it("gives one rectangle per line when a hit runs over a line break", () => {
    const rects = highlightRects(layout, 6, 19); // "wereld\nTweede"
    expect(rects).toHaveLength(2);
    expect(rects[1].left).toBeCloseTo(0.1);
    expect(rects[1].width).toBeCloseTo(0.5 * (6 / 12));
    expect(rects[1].top).toBeGreaterThan(rects[0].top);
  });

  it("gives nothing for a range outside the text", () => {
    expect(highlightRects(layout, 40, 50)).toEqual([]);
  });
});

describe("renderWidth", () => {
  it("draws a page as wide as it shows, in device pixels, in coarse steps", () => {
    expect(renderWidth(500, 2)).toBe(1024);
    expect(renderWidth(500, 1)).toBe(512);
  });

  it("draws at a readable default before the page is measured, and never too large", () => {
    expect(renderWidth(0, 1)).toBe(1024);
    expect(renderWidth(100, 1)).toBe(512);
    expect(renderWidth(10000, 3)).toBe(4096);
  });
});
