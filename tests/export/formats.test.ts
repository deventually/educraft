import { describe, expect, it } from "vitest";
import { EXPORT_KINDS, formatsFor } from "~/lib/export/formats";

describe("formatsFor (P30.1)", () => {
  it("knows the five kinds of result from the brief", () => {
    expect([...EXPORT_KINDS]).toEqual(["document", "table", "rubric", "slides", "test-items"]);
  });

  it("offers Word for every kind", () => {
    for (const kind of EXPORT_KINDS) expect(formatsFor([kind])).toContain("docx");
  });

  it("offers each format once for a result with several kinds", () => {
    expect(formatsFor(["table", "test-items"])).toEqual(formatsFor(["document"]));
  });

  it("falls back to a document when nothing is known", () => {
    expect(formatsFor([])).toEqual(formatsFor(["document"]));
  });
});
