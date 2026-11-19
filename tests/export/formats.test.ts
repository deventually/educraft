import { describe, expect, it } from "vitest";
import { EXPORT_KINDS, formatsFor } from "~/lib/export/formats";

describe("formatsFor (P30.1)", () => {
  it("knows the five kinds of result from the brief", () => {
    expect([...EXPORT_KINDS]).toEqual(["document", "table", "rubric", "slides", "test-items"]);
  });

  it("offers Word, PDF and Markdown for every kind, in that order", () => {
    for (const kind of EXPORT_KINDS)
      expect(formatsFor([kind])).toEqual(expect.arrayContaining(["docx", "pdf", "md"]));
    expect(formatsFor(["document"])).toEqual(["docx", "pdf", "md"]);
  });

  it("adds PowerPoint for slides only, after PDF (P30.4)", () => {
    expect(formatsFor(["slides"])).toEqual(["docx", "pdf", "pptx", "md"]);
    for (const kind of EXPORT_KINDS.filter((k) => k !== "slides"))
      expect(formatsFor([kind])).not.toContain("pptx");
  });

  it("adds Excel for tables and rubrics, after PDF (P30.3)", () => {
    expect(formatsFor(["table"])).toEqual(["docx", "pdf", "xlsx", "md"]);
    expect(formatsFor(["rubric"])).toEqual(["docx", "pdf", "xlsx", "md"]);
    for (const kind of ["document", "slides", "test-items"] as const)
      expect(formatsFor([kind])).not.toContain("xlsx");
  });

  it("offers each format once for a result with several kinds", () => {
    expect(formatsFor(["table", "rubric", "test-items"])).toEqual(formatsFor(["table"]));
  });

  it("falls back to a document when nothing is known", () => {
    expect(formatsFor([])).toEqual(formatsFor(["document"]));
  });
});
