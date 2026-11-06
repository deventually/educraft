import { describe, expect, it } from "vitest";
import { attachmentHeaders, safeFileName } from "~/lib/export/filename";

describe("safeFileName (P30.1)", () => {
  it("strips path and control characters and adds the extension", () => {
    expect(safeFileName('Les 3: "cellen"/basis', "docx", "export")).toBe(
      "Les 3- -cellen--basis.docx",
    );
  });

  it("falls back when nothing is left", () => {
    expect(safeFileName("  ", "docx", "export")).toBe("export.docx");
  });
});

describe("attachmentHeaders", () => {
  it("gives an ASCII fallback and the real name per RFC 5987", () => {
    const h = attachmentHeaders("Toets ë.docx", "application/x-test");
    expect(h["Content-Disposition"]).toBe(
      `attachment; filename="Toets _.docx"; filename*=UTF-8''Toets%20%C3%AB.docx`,
    );
    expect(h["Content-Type"]).toBe("application/x-test");
    expect(h["Cache-Control"]).toBe("private, no-store");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
  });
});
