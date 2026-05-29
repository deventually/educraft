import type { Route } from "./+types/api.stream";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { providerForModel } from "~/lib/ai/provider";
import { isResolvableModel } from "~/lib/ai/models";
import { sseStream, sseError, SSE_HEADERS } from "~/lib/ai/sse";
import { getProfile } from "~/server/repositories/profiles.server";
import { saveGeneration } from "~/server/repositories/generations.server";
import type { OutputLanguage } from "~/lib/registry/types";
import type { TemplateValues } from "~/lib/template/interpolate";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { localizeError } from "~/lib/i18n/errors";

interface StreamBody {
  slug: string;
  stageId?: string;
  values?: TemplateValues;
  contextProfileId?: string | null;
  outputLanguage?: string;
  /** Outputs of earlier stages, keyed by stage id (multi-stage tools). */
  priorOutputs?: Record<string, string>;
  model?: string;
}

export async function action({ request }: Route.ActionArgs) {
  const locale = getLocale(request);
  const m = getMessages(locale);
  try {
    const body = (await request.json()) as StreamBody;

    const tool = getToolBySlug(body.slug);
    if (!tool) return new Response(sseError(m.error.unknownTool), { headers: SSE_HEADERS });

    const stage = tool.stages.find((s) => s.id === body.stageId) ?? tool.stages[0];
    const outputLanguage: OutputLanguage = body.outputLanguage === "en" ? "en" : "nl";

    const profile =
      tool.usesContextProfile && body.contextProfileId ? getProfile(body.contextProfileId) : null;

    const system = buildSystemPrompt({
      promptId: stage.systemPromptId,
      values: body.values ?? {},
      profile,
      outputLanguage,
      priorOutputs: body.priorOutputs ?? {},
      consumes: stage.consumes,
    });

    const model =
      body.model && isResolvableModel(body.model)
        ? body.model
        : stage.model ?? tool.defaultModel;
    const provider = providerForModel(model);

    const trigger =
      outputLanguage === "en" ? "Carry out the task in full." : "Voer de opdracht volledig uit.";
    const tokens = provider.streamChat({
      model,
      system,
      messages: [{ role: "user", content: trigger }],
      temperature: stage.temperature ?? tool.defaultTemperature,
    });

    const stream = sseStream(tokens, {
      formatError: (err) => localizeError(err, locale, m.error.unknown),
      onComplete: (full) => {
        try {
          saveGeneration({
            toolSlug: tool.slug,
            stageId: stage.id,
            model,
            input: body.values ?? {},
            contextProfileId: body.contextProfileId ?? null,
            outputLanguage,
            outputMarkdown: full,
          });
        } catch (e) {
          console.error("Failed to save generation:", e);
        }
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (err) {
    return new Response(sseError(localizeError(err, locale, m.error.unknown)), {
      headers: SSE_HEADERS,
    });
  }
}
