import { z } from "zod";
import type { Tool } from "./types";
import { PROMPTS } from "~/lib/prompts";
import { MODELS } from "~/lib/ai/models";
import { placeholdersIn } from "~/lib/template/interpolate";

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
]);

const inputField = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_]+$/),
  label: z.string().min(1),
  kind: fieldKind,
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  help: z.string().optional(),
  defaultValue: z.any().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  accept: z.string().optional(),
  group: z.string().optional(),
  rows: z.number().optional(),
});

const stageDependency = z.object({
  placeholder: z.string().regex(/^[a-zA-Z0-9_]+$/),
  fromStageId: z.string().min(1),
});

const toolStage = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  systemPromptId: z.string().min(1),
  inputs: z.array(inputField).optional(),
  consumes: z.array(stageDependency).optional(),
  optional: z.boolean().optional(),
  output: z.object({
    kind: z.enum(["markdown", "json", "structured-sections"]),
    hint: z.string().optional(),
    sections: z.array(z.string()).optional(),
  }),
  model: z.string().optional(),
  temperature: z.number().optional(),
});

const toolSchema = z.object({
  id: z.string().min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "slug moet kebab-case zijn"),
  nameNl: z.string().min(1),
  taglineNl: z.string().min(1),
  icon: z.string().optional(),
  userType: z.enum(["instructor", "student"]),
  mode: z.enum(["one-shot", "chat"]),
  theory: z.object({
    name: z.string().min(1),
    summaryNl: z.string().min(1),
    keyCitations: z.array(z.string()),
  }),
  attribution: z.object({
    chapterTitle: z.string().min(1),
    authors: z.string().min(1),
    bookTitle: z.string().min(1),
    editor: z.string().min(1),
    doi: z.string().min(1),
    year: z.number(),
    license: z.literal("CC BY 4.0"),
    sourcePages: z.string().optional(),
    evaluatedWith: z.string().optional(),
    adapted: z.boolean().optional(),
  }),
  inputs: z.array(inputField),
  stages: z.array(toolStage).min(1),
  chat: z
    .object({
      greeting: z.string().optional(),
      starters: z.array(z.string()).optional(),
      allowRegenerate: z.boolean().optional(),
      allowStop: z.boolean().optional(),
    })
    .optional(),
  defaultModel: z.string().min(1),
  defaultTemperature: z.number().optional(),
  usesContextProfile: z.boolean(),
  defaultOutputLanguage: z.enum(["nl", "en"]),
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
 * in each stage's runtime prompt is satisfied by an input, an injected var, or a
 * consumed prior-stage output. Returns all issues (empty array = valid).
 */
export function validateTools(tools: Tool[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const slugs = new Set<string>();
  const ids = new Set<string>();

  for (const tool of tools) {
    const parsed = toolSchema.safeParse(tool);
    if (!parsed.success) {
      for (const e of parsed.error.issues) {
        issues.push({ tool: tool.slug ?? tool.id ?? "?", message: `${e.path.join(".")}: ${e.message}` });
      }
      continue;
    }

    if (slugs.has(tool.slug)) issues.push({ tool: tool.slug, message: "dubbele slug" });
    if (ids.has(tool.id)) issues.push({ tool: tool.slug, message: "dubbele id" });
    slugs.add(tool.slug);
    ids.add(tool.id);

    if (!(tool.defaultModel in MODELS)) {
      issues.push({ tool: tool.slug, message: `onbekend defaultModel: ${tool.defaultModel}` });
    }
    if (tool.mode === "chat" && !tool.chat) {
      issues.push({ tool: tool.slug, message: "mode 'chat' vereist een chat-config" });
    }

    const stageIds = new Set(tool.stages.map((s) => s.id));
    const toolFieldNames = new Set(tool.inputs.map((f) => f.name));

    for (const stage of tool.stages) {
      const prompt = PROMPTS[stage.systemPromptId];
      if (!prompt) {
        issues.push({
          tool: tool.slug,
          message: `fase "${stage.id}": onbekende systemPromptId ${stage.systemPromptId}`,
        });
        continue;
      }
      if (stage.model && !(stage.model in MODELS)) {
        issues.push({ tool: tool.slug, message: `fase "${stage.id}": onbekend model ${stage.model}` });
      }

      // Resolvable placeholder sources: tool inputs + stage inputs + injected + consumed.
      const available = new Set<string>([
        ...toolFieldNames,
        ...(stage.inputs?.map((f) => f.name) ?? []),
        ...INJECTED,
        ...(stage.consumes?.map((c) => c.placeholder) ?? []),
      ]);

      for (const dep of stage.consumes ?? []) {
        if (!stageIds.has(dep.fromStageId)) {
          issues.push({
            tool: tool.slug,
            message: `fase "${stage.id}" consumeert onbekende fase "${dep.fromStageId}"`,
          });
        }
      }

      for (const lang of ["nl", "en"] as const) {
        for (const ph of placeholdersIn(prompt.runtime[lang])) {
          if (!available.has(ph)) {
            issues.push({
              tool: tool.slug,
              message: `fase "${stage.id}" (${lang}): placeholder {{${ph}}} heeft geen bron (input/injected/consumed)`,
            });
          }
        }
      }
    }
  }

  return issues;
}
