import type { Route } from "./+types/api.stream";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { providerForModel } from "~/lib/ai/provider";
import { MODELS } from "~/lib/ai/models";
import { sseStream, sseError, SSE_HEADERS } from "~/lib/ai/sse";
import { getProfile } from "~/server/repositories/profiles.server";
import { saveGeneration } from "~/server/repositories/generations.server";
import type { OutputLanguage } from "~/lib/registry/types";
import type { TemplateValues } from "~/lib/template/interpolate";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";

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
  const m = getMessages(getLocale(request));
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
      body.model && body.model in MODELS ? body.model : stage.model ?? tool.defaultModel;
    const provider = providerForModel(model);

    const tokens = provider.streamChat({
      model,
      system,
      messages: [{ role: "user", content: "Voer de opdracht volledig uit." }],
      temperature: stage.temperature ?? tool.defaultTemperature,
    });

    const stream = sseStream(tokens, {
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
          console.error("Opslaan van generatie mislukt:", e);
        }
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : m.error.unknown;
    return new Response(sseError(message), { headers: SSE_HEADERS });
  }
}
