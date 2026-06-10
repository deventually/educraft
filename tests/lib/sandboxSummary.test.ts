import { describe, it, expect } from "vitest";
import { summarizeSandbox } from "~/lib/forms/summarize";
import type { InputField } from "~/lib/registry/types";

describe("summarizeSandbox", () => {
  it("resolves a select value to its localized option label", () => {
    const fields: InputField[] = [
      {
        name: "theorist",
        label: { nl: "Theoreticus", en: "Theorist" },
        kind: "select",
        options: [{ value: "Lev Vygotsky", label: { nl: "Vygotsky (NL)", en: "Vygotsky (EN)" } }],
      },
    ];

    const items = summarizeSandbox(fields, { theorist: "Lev Vygotsky" }, "en");
    expect(items).toEqual([{ name: "theorist", label: "Theorist", value: "Vygotsky (EN)" }]);

    const nl = summarizeSandbox(fields, { theorist: "Lev Vygotsky" }, "nl");
    expect(nl[0]?.value).toBe("Vygotsky (NL)");
  });

  it("skips empty values so the summary only shows what was entered", () => {
    const fields: InputField[] = [
      { name: "topic", label: { nl: "Onderwerp", en: "Topic" }, kind: "text" },
      { name: "notes", label: { nl: "Notities", en: "Notes" }, kind: "textarea" },
    ];

    const items = summarizeSandbox(fields, { topic: "Photosynthesis", notes: "" }, "en");
    expect(items).toEqual([{ name: "topic", label: "Topic", value: "Photosynthesis" }]);
  });

  it("joins multiselect values via their option labels", () => {
    const fields: InputField[] = [
      {
        name: "goals",
        label: { nl: "Doelen", en: "Goals" },
        kind: "multiselect",
        options: [
          { value: "a", label: { nl: "Analyseren", en: "Analyze" } },
          { value: "b", label: { nl: "Evalueren", en: "Evaluate" } },
        ],
      },
    ];

    const items = summarizeSandbox(fields, { goals: ["a", "b"] }, "en");
    expect(items[0]?.value).toBe("Analyze, Evaluate");
  });

  it("truncates very long free-text values", () => {
    const fields: InputField[] = [
      { name: "essay", label: { nl: "Essay", en: "Essay" }, kind: "textarea" },
    ];
    const long = "x".repeat(200);
    const items = summarizeSandbox(fields, { essay: long }, "en");
    expect(items[0]?.value.length).toBeLessThan(long.length);
    expect(items[0]?.value.endsWith("…")).toBe(true);
  });
});
