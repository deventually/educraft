import type { Route } from "./+types/api.stream";
import { z } from "zod";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { providerForModel } from "~/lib/ai/provider";
import { isResolvableModel, resolveModelInfo } from "~/lib/ai/models";
import { sseStream, sseError, SSE_HEADERS } from "~/lib/ai/sse";
import { getProfile } from "~/server/repositories/profiles.server";
import { saveGeneration, upsertChatGeneration } from "~/server/repositories/generations.server";
import { buildChatTranscript } from "~/lib/chat/transcript";
import type { OutputLanguage, ChatMessage } from "~/lib/registry/types";
import type { ImageInput } from "~/lib/ai/types";
import type { TemplateValues } from "~/lib/template/interpolate";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { localizeError } from "~/lib/i18n/errors";

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const ImageInputSchema = z.object({
  mediaType: z.string().regex(/^image\/(png|jpeg|gif|webp)$/),
  dataBase64: z.string().regex(/^[A-Za-z0-9+/=]+$/),
});

interface StreamBody {
  slug: string;
  stageId?: string;
  values?: TemplateValues;
  contextProfileId?: string | null;
  outputLanguage?: string;
  /** Outputs of earlier stages, keyed by stage id (multi-stage tools). */
  priorOutputs?: Record<string, string>;
  model?: string;
  /** For chat mode: full message history (user turns + assistant responses). */
  messages?: ChatMessage[];
  /** For chat mode: stable id grouping every turn into one saved project. */
  sessionId?: string;
  /** Images for vision-capable tools. */
  images?: ImageInput[];
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
      body.model && isResolvableModel(body.model) ? body.model : (stage.model ?? tool.defaultModel);
    const provider = providerForModel(model);

    // Validate images if provided
    let images: ImageInput[] | undefined;
    if (body.images && body.images.length > 0) {
      // Check model supports images
      const modelInfo = resolveModelInfo(model);
      if (!modelInfo.supportsImages) {
        const errorMsg =
          outputLanguage === "en"
            ? `This model (${modelInfo.displayName}) does not support image analysis. Please select a vision-capable model.`
            : `Dit model (${modelInfo.displayName}) ondersteunt geen afbeeldingsanalyse. Selecteer een model met visiecapaciteit.`;
        return new Response(sseError(errorMsg), { headers: SSE_HEADERS });
      }

      // Validate image array
      const validated = z.array(ImageInputSchema).safeParse(body.images);
      if (!validated.success) {
        const errorMsg =
          outputLanguage === "en"
            ? "Invalid image format. Images must be PNG or JPEG."
            : "Ongeldig afbeeldingsformaat. Afbeeldingen moeten PNG of JPEG zijn.";
        return new Response(sseError(errorMsg), { headers: SSE_HEADERS });
      }

      // Check image count
      if (validated.data.length > 10) {
        const errorMsg =
          outputLanguage === "en"
            ? "Too many images. Maximum 10 images allowed."
            : "Te veel afbeeldingen. Maximaal 10 afbeeldingen toegestaan.";
        return new Response(sseError(errorMsg), { headers: SSE_HEADERS });
      }

      images = validated.data;
    }

    // Chat mode: use provided message history; one-shot: trigger with initial message
    let messages: ChatMessage[];
    if (tool.mode === "chat" && body.messages) {
      // Validate message array
      const validated = z.array(ChatMessageSchema).safeParse(body.messages);
      if (!validated.success) {
        return new Response(sseError("Invalid message format"), { headers: SSE_HEADERS });
      }
      messages = validated.data;
    } else {
      // One-shot/multi-stage: single trigger message
      const trigger =
        outputLanguage === "en" ? "Carry out the task in full." : "Voer de opdracht volledig uit.";
      messages = [{ role: "user", content: trigger }];
    }

    const tokens = provider.streamChat({
      model,
      system,
      messages,
      images,
      temperature: stage.temperature ?? tool.defaultTemperature,
    });

    const stream = sseStream(tokens, {
      formatError: (err) => localizeError(err, locale, m.error.unknown),
      onComplete: (full) => {
        try {
          const sessionId =
            tool.mode === "chat" && typeof body.sessionId === "string" ? body.sessionId.trim() : "";
          if (sessionId.length >= 8 && sessionId.length <= 100) {
            // Chat: collapse the whole conversation into one project row,
            // rewritten on every turn rather than one row per message.
            upsertChatGeneration({
              id: sessionId,
              toolSlug: tool.slug,
              stageId: stage.id,
              model,
              input: body.values ?? {},
              contextProfileId: body.contextProfileId ?? null,
              outputLanguage,
              transcript: buildChatTranscript(
                [...messages, { role: "assistant", content: full }],
                outputLanguage,
              ),
            });
          } else {
            saveGeneration({
              toolSlug: tool.slug,
              stageId: stage.id,
              model,
              input: body.values ?? {},
              contextProfileId: body.contextProfileId ?? null,
              outputLanguage,
              outputMarkdown: full,
            });
          }
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
