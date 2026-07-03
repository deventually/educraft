import type { Route } from "./+types/api.stream";
import { z } from "zod";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt, reinforceLanguage } from "~/lib/template/buildSystemPrompt";
import { providerForModel } from "~/lib/ai/provider";
import { isResolvableModel, isClientSelectable, resolveModelInfo } from "~/lib/ai/models";
import { sseStream, sseError, SSE_HEADERS } from "~/lib/ai/sse";
import { getProfile } from "~/server/repositories/profiles.server";
import { saveGeneration, upsertChatGeneration } from "~/server/repositories/generations.server";
import { getUser } from "~/server/auth.server";
import { canUseTool } from "~/lib/registry/access";
import { buildChatTranscript } from "~/lib/chat/transcript";
import type { OutputLanguage, ChatMessage } from "~/lib/registry/types";
import type { ImageInput } from "~/lib/ai/types";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { localizeError } from "~/lib/i18n/errors";
import { createRateLimiter } from "~/server/rateLimit.server";
import { env } from "~/server/env.server";

// Boundaries: every value is length/count-capped so a hostile body can never
// balloon the prompt (and thus the owner's token bill) or exhaust memory.
const MAX_VALUE_CHARS = 20_000; // per form field (documents land here as text)
const MAX_VALUES_KEYS = 40;
const MAX_MESSAGE_CHARS = 20_000; // per chat message
const MAX_MESSAGES = 100;
const MAX_PRIOR_OUTPUT_CHARS = 60_000; // multi-stage outputs can be long
// Reject before buffering the body when the declared size is implausible.
// 10 images × ~1.9 MB base64 ≈ 19 MB + text headroom.
const MAX_BODY_BYTES = 25 * 1024 * 1024;

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const ImageInputSchema = z.object({
  mediaType: z.string().regex(/^image\/(png|jpeg|gif|webp)$/),
  dataBase64: z.string().regex(/^[A-Za-z0-9+/=]+$/),
});

// Mirrors TemplateValue (see lib/template/interpolate): string | number | boolean
// | string[] | null — each string bounded so a single field can't run away.
const TemplateValueSchema = z.union([
  z.string().max(MAX_VALUE_CHARS),
  z.number(),
  z.boolean(),
  z.array(z.string().max(MAX_VALUE_CHARS)).max(50),
  z.null(),
]);

const StreamBodySchema = z.object({
  slug: z.string().min(1).max(100),
  stageId: z.string().max(100).optional(),
  values: z
    .record(z.string().max(100), TemplateValueSchema)
    .refine((v) => Object.keys(v).length <= MAX_VALUES_KEYS, "too many values")
    .optional(),
  contextProfileId: z.string().max(100).nullish(),
  outputLanguage: z.enum(["nl", "en"]).optional(),
  priorOutputs: z.record(z.string().max(100), z.string().max(MAX_PRIOR_OUTPUT_CHARS)).optional(),
  model: z.string().max(200).optional(),
  messages: z
    .array(ChatMessageSchema.extend({ content: z.string().max(MAX_MESSAGE_CHARS) }))
    .max(MAX_MESSAGES)
    .optional(),
  sessionId: z.string().min(8).max(100).optional(),
  images: z.array(ImageInputSchema).max(10).optional(),
});

// Process-local abuse limits. Single-instance deployment makes in-memory state
// sound (see rateLimit.server). One map for the whole process.
const rateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: env.RATE_LIMIT_PER_MINUTE,
  maxConcurrent: env.RATE_LIMIT_CONCURRENT,
});

export async function action({ request }: Route.ActionArgs) {
  const locale = getLocale(request);
  const m = getMessages(locale);

  // Authenticate first: an anonymous caller never reaches the model. The result
  // is a localized SSE error (the client renders it in the result panel) rather
  // than a redirect, which a fetch()-driven stream can't follow.
  const user = await getUser(request);
  if (!user) {
    return new Response(sseError(m.error.unauthorized), { headers: SSE_HEADERS });
  }

  // Cheap early reject on the declared body size, before buffering it.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return new Response(sseError(m.error.invalidRequest), { headers: SSE_HEADERS });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return new Response(sseError(m.error.invalidRequest), { headers: SSE_HEADERS });
  }

  // Validate the whole body at the boundary. Never echo Zod detail to the client;
  // log it server-side for debugging.
  const parsed = StreamBodySchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Rejected /api/stream body:", parsed.error.flatten());
    return new Response(sseError(m.error.invalidRequest), { headers: SSE_HEADERS });
  }
  const body = parsed.data;

  try {
    const tool = getToolBySlug(body.slug);
    if (!tool) return new Response(sseError(m.error.unknownTool), { headers: SSE_HEADERS });

    // Role gate (server-side, not just UI): a student can't drive an instructor
    // tool via a hand-crafted POST.
    if (!canUseTool(user, tool)) {
      return new Response(sseError(m.error.notAllowed), { headers: SSE_HEADERS });
    }

    const stage = tool.stages.find((s) => s.id === body.stageId) ?? tool.stages[0];
    const outputLanguage: OutputLanguage = body.outputLanguage === "en" ? "en" : "nl";

    // Resolve the profile scoped to the requesting user — never fetch another
    // user's profile by id (audit finding #2).
    const profile =
      tool.usesContextProfile && body.contextProfileId
        ? await getProfile(user.id, body.contextProfileId)
        : null;

    const system = buildSystemPrompt({
      promptId: stage.systemPromptId,
      values: body.values ?? {},
      profile,
      outputLanguage,
      priorOutputs: body.priorOutputs ?? {},
      consumes: stage.consumes,
    });

    // Server-side model allow-list: a caller may only pick a *client-selectable*
    // model (never Opus-class). Anything else falls back to the tool/stage
    // default, so a hostile body can't force an expensive model on the owner.
    const model =
      body.model && isResolvableModel(body.model) && isClientSelectable(body.model)
        ? body.model
        : (stage.model ?? tool.defaultModel);
    const provider = providerForModel(model);

    // Vision gate. The image array is already shape/size/count-validated by the
    // schema; here we only refuse images to a non-vision model.
    let images: ImageInput[] | undefined;
    if (body.images && body.images.length > 0) {
      const modelInfo = resolveModelInfo(model);
      if (!modelInfo.supportsImages) {
        return new Response(
          sseError(m.error.modelNoVision.replace("{model}", modelInfo.displayName)),
          { headers: SSE_HEADERS },
        );
      }
      images = body.images;
    }

    // Chat mode: use the provided history. One-shot/multi-stage: single trigger.
    let messages: ChatMessage[];
    if (tool.mode === "chat" && body.messages) {
      messages = body.messages;
    } else {
      const trigger =
        outputLanguage === "en" ? "Carry out the task in full." : "Voer de opdracht volledig uit.";
      messages = [{ role: "user", content: trigger }];
    }

    // Echo the language directive on the final user turn so a mid-chat language
    // switch overrides the momentum of earlier turns. The saved transcript keeps
    // the untouched `messages`.
    const promptMessages =
      tool.mode === "chat" ? reinforceLanguage(messages, outputLanguage) : messages;

    // Reserve a rate + concurrency slot as late as possible: only a request that
    // will actually stream counts against the budget. The slot is freed in
    // onFinally, which runs whether the stream completes, errors, or is closed.
    // Keyed by the authenticated user id (Phase 1) — abuse budgets follow the
    // account, not a spoofable IP/session pair.
    const gate = rateLimiter.acquire(user.id);
    if (!gate.ok) {
      return new Response(sseError(m.error.rateLimited), { headers: SSE_HEADERS });
    }

    const tokens = provider.streamChat({
      model,
      system,
      messages: promptMessages,
      images,
      temperature: stage.temperature ?? tool.defaultTemperature,
      maxTokens: stage.maxTokens ?? tool.defaultMaxTokens,
    });

    const stream = sseStream(tokens, {
      formatError: (err) => localizeError(err, locale, m.error.unknown),
      onFinally: () => gate.release(),
      onComplete: async (full) => {
        try {
          const sessionId =
            tool.mode === "chat" && typeof body.sessionId === "string" ? body.sessionId.trim() : "";
          if (sessionId.length >= 8 && sessionId.length <= 100) {
            // Chat: collapse the whole conversation into one project row,
            // rewritten on every turn rather than one row per message.
            await upsertChatGeneration({
              id: sessionId,
              userId: user.id,
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
            await saveGeneration({
              userId: user.id,
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
