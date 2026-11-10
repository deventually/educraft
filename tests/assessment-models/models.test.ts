import { describe, expect, it } from "vitest";
import {
  AssessmentModelDataSchema,
  STARTER_MODELS,
  applyAssessmentModel,
  ownModelFor,
  untouchedSince,
  type ModelChoice,
} from "~/lib/assessment-models";
import { getToolBySlug } from "~/lib/registry";
import type { InputField } from "~/lib/registry/types";

const fields: InputField[] = [
  { name: "documentType", label: "Type", kind: "select" },
  {
    name: "assessmentFramework",
    label: "Kader",
    kind: "textarea",
    prefillFromAssessmentModel: { source: "framework" },
  },
  {
    name: "assessmentScale",
    label: "Schaal",
    kind: "textarea",
    prefillFromAssessmentModel: { source: "scale" },
  },
];

const model = (id: string, documentTypes: string[], starter = false): ModelChoice => ({
  id,
  name: id,
  documentTypes,
  framework: `kader ${id}`,
  scale: `schaal ${id}`,
  starter,
});

describe("AssessmentModelDataSchema", () => {
  it("accepts a framework with an empty scale (feedback only)", () => {
    expect(
      AssessmentModelDataSchema.parse({ documentTypes: ["essay"], framework: "C1", scale: "" }),
    ).toEqual({ documentTypes: ["essay"], framework: "C1", scale: "" });
  });

  it("refuses a model without a framework", () => {
    expect(() =>
      AssessmentModelDataSchema.parse({ documentTypes: [], framework: "  ", scale: "x" }),
    ).toThrow();
  });

  it("refuses unknown keys and over-long text", () => {
    expect(() =>
      AssessmentModelDataSchema.parse({ documentTypes: [], framework: "C1", scale: "", x: 1 }),
    ).toThrow();
    expect(() =>
      AssessmentModelDataSchema.parse({
        documentTypes: [],
        framework: "x".repeat(30_001),
        scale: "",
      }),
    ).toThrow();
  });
});

describe("STARTER_MODELS", () => {
  const types = (getToolBySlug("stage-assessment")?.inputs ?? [])
    .find((f) => f.name === "documentType")
    ?.options?.map((o) => o.value);

  it("offers the HBO-i internship model and general starters, each valid and bilingual", () => {
    expect(STARTER_MODELS.map((m) => m.id)).toEqual(
      expect.arrayContaining(["hbo-i-stage", "afstudeerscriptie", "onderzoeksverslag", "essay"]),
    );
    for (const m of STARTER_MODELS) {
      for (const lang of ["nl", "en"] as const) {
        expect(m.name[lang].trim()).not.toBe("");
        AssessmentModelDataSchema.parse({
          documentTypes: m.documentTypes,
          framework: m.framework[lang],
          scale: m.scale[lang],
        });
      }
      for (const t of m.documentTypes) expect(types).toContain(t);
    }
  });
});

describe("ownModelFor", () => {
  it("picks the teacher's first own model for the document type, never a starter", () => {
    const models = [
      model("start", ["essay"], true),
      model("mine-report", ["verslag"]),
      model("mine-essay", ["essay"]),
      model("mine-essay-2", ["essay"]),
    ];
    expect(ownModelFor(models, "essay")?.id).toBe("mine-essay");
    expect(ownModelFor(models, "stageplan")).toBeUndefined();
  });
});

describe("applyAssessmentModel", () => {
  it("fills the framework and scale fields from the model", () => {
    expect(applyAssessmentModel(fields, model("m", ["essay"]))).toEqual({
      assessmentFramework: "kader m",
      assessmentScale: "schaal m",
    });
  });

  it("empties them when no model is chosen", () => {
    expect(applyAssessmentModel(fields, undefined)).toEqual({
      assessmentFramework: "",
      assessmentScale: "",
    });
  });
});

describe("untouchedSince", () => {
  const applied = applyAssessmentModel(fields, model("m", ["essay"]));

  it("is true while the teacher has not changed what a model filled in", () => {
    expect(untouchedSince(fields, { ...applied, documentType: "essay" }, applied)).toBe(true);
  });

  it("is true for empty fields, so a first model may fill them", () => {
    const empty = applyAssessmentModel(fields, undefined);
    expect(untouchedSince(fields, empty, undefined)).toBe(true);
  });

  it("is false once the teacher typed in a field", () => {
    expect(untouchedSince(fields, { ...applied, assessmentScale: "eigen" }, applied)).toBe(false);
    expect(untouchedSince(fields, { assessmentFramework: "eigen" }, undefined)).toBe(false);
  });
});
