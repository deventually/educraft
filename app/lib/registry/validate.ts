import { COMPUTATION_IDS } from "~/lib/template/computations";
import { z } from "zod";
import { DOSSIER_PLACEHOLDERS } from "~/lib/portfolio/rehearsal";
import { COURSE_ITEM_KINDS, type Tool } from "./types";
import { PROMPTS } from "~/lib/prompts";
import { MODELS } from "~/lib/ai/models";
import { placeholdersIn } from "~/lib/template/interpolate";
import { DERIVATION_IDS } from "~/lib/template/derivations";
import { EXPORT_KINDS } from "~/lib/export/formats";

/** Placeholders that buildSystemPrompt always injects (not from form fields). */
const INJECTED = new Set(["contextProfile", "outputLanguage"]);

const fieldKind = z.enum([
  "text",
  "textarea",
  "select",
  "multiselect",
  "number",
  "boolean",
  "file",
  "image",
  "document",
]);

/** A plain string or a per-locale { nl, en } object (see lib/i18n/localized). */
const localizedText = z.union([
  z.string().min(1),
  z.object({ nl: z.string().min(1), en: z.string().min(1) }),
]);

/** Output-token cap: positive and not absurd (guards against typos/abuse). */
const maxTokens = z
  .number()
  .int("maxTokens must be an integer")
  .positive("maxTokens must be positive")
  .max(32_000, "maxTokens must be <= 32000");

const inputField = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_]+$/),
  label: localizedText,
  kind: fieldKind,
  required: z.boolean().optional(),
  placeholder: localizedText.optional(),
  help: localizedText.optional(),
  defaultValue: z.any().optional(),
  options: z.array(z.object({ value: z.string(), label: localizedText })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  accept: z.string().optional(),
  group: localizedText.optional(),
  rows: z.number().optional(),
  imagesFrom: z.string().optional(),
  prefillFromAssessmentModel: z.object({ source: z.enum(["framework", "scale"]) }).optional(),
});

const stageDependency = z.object({
  placeholder: z.string().regex(/^[a-zA-Z0-9_]+$/),
  fromStageId: z.string().min(1),
  derive: z.enum(DERIVATION_IDS).optional(),
});

const toolStage = z.object({
  id: z.string().min(1),
  name: localizedText,
  description: localizedText.optional(),
  systemPromptId: z.string().min(1),
  inputs: z.array(inputField).optional(),
  consumes: z.array(stageDependency).optional(),
  optional: z.boolean().optional(),
  output: z
    .object({
      kind: z.enum(["markdown", "json", "structured-sections"]),
      hint: localizedText.optional(),
      sections: z.array(z.string()).optional(),
      exportAs: z.enum(EXPORT_KINDS).optional(),
      slides: z
        .object({ opening: localizedText, phases: localizedText, closing: localizedText })
        .optional(),
      computed: z.enum(COMPUTATION_IDS).optional(),
    })
    .refine((o) => o.exportAs !== "slides" || o.slides, {
      message: "a slides result names its slide headings (output.slides)",
      path: ["slides"],
    }),
  model: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: maxTokens.optional(),
});

const toolSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  name: localizedText,
  tagline: localizedText,
  icon: z.string().optional(),
  userType: z.enum(["instructor", "student"]),
  mode: z.enum(["one-shot", "chat"]),
  theory: z.object({
    name: localizedText,
    summary: localizedText,
    keyCitations: z.array(z.string()),
  }),
  attribution: z.object({
    original: z.boolean().optional(),
    source: localizedText.optional(),
    chapterTitle: z.string().min(1).optional(),
    authors: z.string().min(1).optional(),
    bookTitle: z.string().min(1).optional(),
    editor: z.string().min(1).optional(),
    doi: z.string().min(1).optional(),
    year: z.number().optional(),
    license: z.literal("CC BY 4.0"),
    sourcePages: z.string().optional(),
    evaluatedWith: localizedText.optional(),
    adapted: z.boolean().optional(),
  }),
  inputs: z.array(inputField),
  stages: z.array(toolStage).min(1),
  chat: z
    .object({
      greeting: localizedText.optional(),
      starters: z.array(localizedText).optional(),
      allowRegenerate: z.boolean().optional(),
      allowStop: z.boolean().optional(),
      quickReplies: z.array(localizedText).max(3).optional(),
    })
    .optional(),
  defaultModel: z.string().min(1),
  defaultTemperature: z.number().optional(),
  defaultMaxTokens: maxTokens.optional(),
  usesContextProfile: z.boolean(),
  assessmentModels: z.object({ byField: z.string().min(1) }).optional(),
  contextFrom: z.literal("dossier").optional(),
  hiddenFromCatalogue: z.literal(true).optional(),
  storesConversation: z.literal(false).optional(),
  handlesStudentWork: z.literal(true).optional(),
  defaultOutputLanguage: z.enum(["nl", "en"]),
  next: z.array(z.string().min(1)).max(3).optional(),
  courseActions: z
    .array(z.enum(COURSE_ITEM_KINDS))
    .refine((kinds) => new Set(kinds).size === kinds.length, "courseActions: a kind twice")
    .optional(),
  enabled: z.boolean(),
  phase: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

export interface ValidationIssue {
  tool: string;
  message: string;
}

/**
 * Validate a list of tools: shape (zod), unique slugs/ids, resolvable models and
 * prompt ids, valid stage `consumes` references, and that every {{placeholder}}
 * in each stage's runtime prompt (both language variants) is satisfied by an
 * input, an injected var, or a consumed prior-stage output. Returns all issues
 * (empty array = valid).
 */
export function validateTools(tools: Tool[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const slugs = new Set<string>();
  const ids = new Set<string>();

  for (const tool of tools) {
    const parsed = toolSchema.safeParse(tool);
    if (!parsed.success) {
      for (const e of parsed.error.issues) {
        issues.push({
          tool: tool.slug ?? tool.id ?? "?",
          message: `${e.path.join(".")}: ${e.message}`,
        });
      }
      continue;
    }

    if (slugs.has(tool.slug)) issues.push({ tool: tool.slug, message: "duplicate slug" });
    if (ids.has(tool.id)) issues.push({ tool: tool.slug, message: "duplicate id" });
    slugs.add(tool.slug);
    ids.add(tool.id);

    if (!(tool.defaultModel in MODELS)) {
      issues.push({ tool: tool.slug, message: `unknown defaultModel: ${tool.defaultModel}` });
    }
    if (tool.mode === "chat" && !tool.chat) {
      issues.push({ tool: tool.slug, message: "mode 'chat' requires a chat config" });
    }

    const documentFields = new Set(
      tool.inputs.filter((f) => f.kind === "document").map((f) => f.name),
    );
    for (const f of tool.inputs) {
      if (f.imagesFrom !== undefined && !documentFields.has(f.imagesFrom)) {
        issues.push({
          tool: tool.slug,
          message: `input "${f.name}": imagesFrom must name a document field, got ${f.imagesFrom}`,
        });
      }
    }

    const byField = tool.assessmentModels?.byField;
    if (
      byField !== undefined &&
      !tool.inputs.some((f) => f.name === byField && f.kind === "select")
    ) {
      issues.push({
        tool: tool.slug,
        message: `assessmentModels.byField must name a select field, got ${byField}`,
      });
    }
    for (const f of tool.inputs) {
      if (f.prefillFromAssessmentModel && !tool.assessmentModels) {
        issues.push({
          tool: tool.slug,
          message: `input "${f.name}": prefillFromAssessmentModel needs Tool.assessmentModels`,
        });
      }
    }

    const stageIds = new Set(tool.stages.map((s) => s.id));
    const toolFieldNames = new Set(tool.inputs.map((f) => f.name));

    for (const stage of tool.stages) {
      const prompt = PROMPTS[stage.systemPromptId];
      if (!prompt) {
        issues.push({
          tool: tool.slug,
          message: `stage "${stage.id}": unknown systemPromptId ${stage.systemPromptId}`,
        });
        continue;
      }
      if (stage.model && !(stage.model in MODELS)) {
        issues.push({
          tool: tool.slug,
          message: `stage "${stage.id}": unknown model ${stage.model}`,
        });
      }

      // Resolvable placeholder sources: tool inputs + stage inputs + injected + consumed.
      const available = new Set<string>([
        ...toolFieldNames,
        ...(stage.inputs?.map((f) => f.name) ?? []),
        ...INJECTED,
        ...(stage.consumes?.map((c) => c.placeholder) ?? []),
        ...(tool.contextFrom === "dossier" ? DOSSIER_PLACEHOLDERS : []),
      ]);

      for (const dep of stage.consumes ?? []) {
        if (!stageIds.has(dep.fromStageId)) {
          issues.push({
            tool: tool.slug,
            message: `stage "${stage.id}" consumes unknown stage "${dep.fromStageId}"`,
          });
        }
      }

      for (const lang of ["nl", "en"] as const) {
        for (const ph of placeholdersIn(prompt.runtime[lang])) {
          if (!available.has(ph)) {
            issues.push({
              tool: tool.slug,
              message: `stage "${stage.id}" (${lang}): placeholder {{${ph}}} has no source (input/injected/consumed)`,
            });
          }
        }
      }
    }
  }

  // Next steps (P27.1) point to another tool in the same list.
  for (const tool of tools) {
    for (const slug of tool.next ?? []) {
      if (slug === tool.slug)
        issues.push({ tool: tool.slug, message: "next: a tool cannot point to itself" });
      else if (!slugs.has(slug))
        issues.push({ tool: tool.slug, message: `next: unknown tool ${slug}` });
    }
  }

  return issues;
}
