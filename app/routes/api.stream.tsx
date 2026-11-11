import type { Route } from "./+types/api.stream";
import { z } from "zod";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { modeOf } from "~/lib/registry/modes";
import { providerForModel } from "~/lib/ai/provider";
import { resolveModelInfo } from "~/lib/ai/models";
import { sseStream, sseError, SSE_HEADERS } from "~/lib/ai/sse";
import { getProfile } from "~/server/repositories/profiles.server";
import { servedModelFor, isToolAvailable } from "~/server/availability.server";
import { saveGeneration, upsertChatGeneration } from "~/server/repositories/generations.server";
import { linkGeneration } from "~/server/repositories/courses.server";
import { getUser } from "~/server/auth.server";
import { buildChatTranscript } from "~/lib/chat/transcript";
import type { OutputLanguage, Tool } from "~/lib/registry/types";
import type { ImageInput } from "~/lib/ai/types";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { localizeError } from "~/lib/i18n/errors";
import { createRateLimiter } from "~/server/rateLimit.server";
import { env } from "~/server/env.server";
import { log } from "~/server/log.server";
import { checkQuota, recordUsage } from "~/server/repositories/usage.server";
import { portfolioAccess } from "~/server/portfolioAccess.server";
import { getDossier } from "~/server/repositories/portfolio.server";
import { getInvalidToolSlugs } from "~/lib/registry/boot.server";
import { dossierPromptValues } from "~/lib/portfolio/rehearsal";

// Boundaries: every value is length/count-capped so a hostile body can never
// balloon the prompt (and thus the owner's token bill) or exhaust memory.
const MAX_VALUE_CHARS = 20_000; // per form field
const MAX_DOCUMENT_CHARS = 300_000; // per `document` field: a whole report or portfolio
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
// | string[] | null. The per-field bound depends on the field's kind, so this is
// only the outer ceiling; `fieldCapError` applies the real cap once the tool is known.
const TemplateValueSchema = z.union([
  z.string().max(MAX_BODY_BYTES),
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
  /** Reasoning switch for thinking-capable local models (see availability/ollama). */
  thinking: z.boolean().optional(),
  messages: z
    .array(ChatMessageSchema.extend({ content: z.string().max(MAX_MESSAGE_CHARS) }))
    .max(MAX_MESSAGES)
    .optional(),
  sessionId: z.string().min(8).max(100).optional(),
  /** Course this work belongs to (P20.4); linked after saving, a foreign id is ignored. */
  courseId: z.string().max(100).nullish(),
  /** The lesson or test of that course (P27.4); an unknown item refuses the link. */
  itemId: z.string().max(100).nullish(),
  images: z.array(ImageInputSchema).max(10).optional(),
  /** The caller's own dossier, for a tool with `contextFrom: "dossier"` (P29.3). */
  dossierId: z.string().max(100).optional(),
});

/**
 * May this user drive this tool? A catalogue tool follows tool availability; a tool
 * that takes its context from the dossier follows the BDB/BKE workplace (P28.3).
 */
async function mayUse(user: { id: string; role: string }, tool: Tool): Promise<boolean> {
  if (tool.contextFrom === "dossier")
    return !getInvalidToolSlugs().has(tool.slug) && (await portfolioAccess(user));
  return isToolAvailable(user, tool);
}

// Process-local abuse limits. Single-instance deployment makes in-memory state
// sound (see rateLimit.server). One map for the whole process.
const rateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: env.RATE_LIMIT_PER_MINUTE,
  maxConcurrent: env.RATE_LIMIT_CONCURRENT,
});

/**
 * The message key for the first value over its field's cap, or null. A `document`
 * field carries a whole report, so it gets its own cap and an error the teacher
 * can act on; a plain field over its cap is not something the form produces.
 */
function fieldCapError(
  tool: Tool,
  values: Record<string, unknown>,
): "documentTooLong" | "invalidRequest" | null {
  const documentFields = new Set(
    tool.inputs.filter((f) => f.kind === "document").map((f) => f.name),
  );
  for (const [name, value] of Object.entries(values)) {
    if (typeof value !== "string") continue;
    if (documentFields.has(name)) {
      if (value.length > MAX_DOCUMENT_CHARS) return "documentTooLong";
    } else if (value.length > MAX_VALUE_CHARS) {
      return "invalidRequest";
    }
  }
  return null;
}

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

    // Effective-availability gate (server-side, not just UI): a disabled tool or a
    // tool outside a narrowed teacher's allow-list can't be driven via a
    // hand-crafted POST.
    if (!(await mayUse(user, tool))) {
      return new Response(sseError(m.error.notAllowed), { headers: SSE_HEADERS });
    }
    const capError = fieldCapError(tool, body.values ?? {});
    if (capError) {
      return new Response(
        sseError(m.error[capError].replace("{max}", MAX_DOCUMENT_CHARS.toLocaleString(locale))),
        { headers: SSE_HEADERS },
      );
    }

    const stage = tool.stages.find((s) => s.id === body.stageId) ?? tool.stages[0];
    const mode = modeOf(tool);
    const outputLanguage: OutputLanguage = body.outputLanguage === "en" ? "en" : "nl";

    // Level register follows WHO reads the output: a student-facing tutor gets the
    // direct-address directive, an instructor tool the substance-first one (P6.8).
    const audience = tool.userType === "student" ? "learner" : "instructor";

    // Resolve the profile scoped to the requesting user — never fetch another
    // user's profile by id (audit finding #2).
    const profile =
      tool.usesContextProfile && body.contextProfileId
        ? await getProfile(user.id, body.contextProfileId)
        : null;
    // A dossier tool (P29.3): the material comes from the caller's own dossier, built
    // here; of the body only the teacher's choices count. A foreign or unknown dossier
    // is refused like a disabled tool.
    let values = body.values ?? {};
    if (tool.contextFrom === "dossier") {
      const dossier = body.dossierId ? await getDossier(user.id, body.dossierId) : null;
      if (!dossier) return new Response(sseError(m.error.notAllowed), { headers: SSE_HEADERS });
      values = dossierPromptValues(dossier.data, values, outputLanguage);
    }

    const system = buildSystemPrompt({
      promptId: stage.systemPromptId,
      values,
      profile,
      outputLanguage,
      priorOutputs: body.priorOutputs ?? {},
      consumes: stage.consumes,
      audience,
    });

    // Server-side model allow-list: a caller may only pick a model in THEIR effective
    // set — the instance allow-list, or the teacher's own set when they have one
    // (override, P18). The same gate governs local/CLI/discovered models, which exist
    // only outside production. Anything else falls back to the tool/stage
    // default, so a hostile body can't force an expensive, disabled, or un-granted
    // model on the owner.
    // A stage may pin a specific model (infra), respected as-is (but upgraded);
    // otherwise the soft default (tool.defaultModel) is resolved to a model THIS
    // caller may actually use — so a disabled/un-granted default can't leak past the
    // teacher gate when the requested model is refused (Phase 14 bugfix). A retired
    // model hands over to its newest version; a retiring one still finishes a chat.
    const model = await servedModelFor(user, body.model, tool.defaultModel, stage.model);
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

    // Structured metadata for the per-generation log line — metadata only, never
    // prompt/response content (user data stays out of logs).
    const logFields = {
      userId: user.id,
      toolSlug: tool.slug,
      stageId: stage.id,
      model,
      mode: tool.mode,
      outputLanguage,
    };

    // Per-user daily quota (audit finding #8). Checked after auth, before the
    // provider call. Admins are exempt. Over quota → localized SSE error.
    if (user.role !== "admin") {
      const { ok } = await checkQuota(user.id);
      if (!ok) {
        log("generation", { ...logFields, outcome: "quota_exceeded", durationMs: 0 });
        return new Response(sseError(m.error.quotaExceeded), { headers: SSE_HEADERS });
      }
    }

    // The mode decides the turns: a chat's own history, or one trigger. A chat also repeats
    // the language on its last turn, so a mid-chat switch wins over the earlier turns' momentum;
    // the saved transcript keeps the untouched `messages`.
    const messages = mode.turns(body.messages, outputLanguage);
    const promptMessages = mode.promptTurns(messages, outputLanguage);

    // Reserve a rate + concurrency slot as late as possible: only a request that
    // will actually stream counts against the budget. The slot is freed in
    // onFinally, which runs whether the stream completes, errors, or is closed.
    // Keyed by the authenticated user id (Phase 1) — abuse budgets follow the
    // account, not a spoofable IP/session pair.
    const gate = rateLimiter.acquire(user.id);
    if (!gate.ok) {
      log("generation", { ...logFields, outcome: "rate_limited", durationMs: 0 });
      return new Response(sseError(m.error.rateLimited), { headers: SSE_HEADERS });
    }

    // The model call stops when the teacher closes the tab: the request aborts, or
    // the response stream is cancelled (whichever the server notices first).
    const cancelled = new AbortController();
    const signal = AbortSignal.any([request.signal, cancelled.signal]);

    const startedAt = Date.now();
    const tokens = provider.streamChat({
      model,
      system,
      messages: promptMessages,
      images,
      temperature: stage.temperature ?? tool.defaultTemperature,
      maxTokens: stage.maxTokens ?? tool.defaultMaxTokens,
      // Reasoning switch, only for the native Ollama adapter; absent = model default.
      thinking: body.thinking,
      cacheKey: mode.cachesPrompt ? `${user.id}:${tool.slug}` : undefined,
      signal,
    });

    const stream = sseStream(tokens, {
      formatError: (err) => {
        // One log line on a mid-stream failure. Metadata only.
        log("generation", {
          ...logFields,
          outcome: "error",
          durationMs: Date.now() - startedAt,
        });
        return localizeError(err, locale, m.error.unknown);
      },
      onFinally: () => gate.release(),
      onCancel: () => {
        cancelled.abort();
        log("generation", { ...logFields, outcome: "aborted", durationMs: Date.now() - startedAt });
      },
      onComplete: async (full) => {
        // Record usage against the daily quota and emit the success log line.
        // Known limit: we count chars only. Tokens (inputTokens/outputTokens) need the AI SDK
        // adapter to expose the stream `usage` promise (see lib/ai/adapters/aisdk.ts).
        try {
          await recordUsage(user.id, { chars: full.length });
        } catch (e) {
          console.error("Failed to record usage:", e);
        }
        log("generation", {
          ...logFields,
          outcome: "ok",
          durationMs: Date.now() - startedAt,
          chars: full.length,
        });
        // Not every conversation is kept (P29.3: only the feedback, on request).
        if (tool.storesConversation === false) return;
        try {
          const sessionId = mode.sessionId(body.sessionId);
          let generationId: string;
          if (sessionId) {
            generationId = sessionId;
            // Chat: collapse the whole conversation into one project row,
            // rewritten on every turn rather than one row per message.
            await upsertChatGeneration({
              id: sessionId,
              userId: user.id,
              toolSlug: tool.slug,
              stageId: stage.id,
              model,
              input: values,
              contextProfileId: body.contextProfileId ?? null,
              outputLanguage,
              transcript: buildChatTranscript(
                [...messages, { role: "assistant", content: full }],
                outputLanguage,
              ),
            });
          } else {
            const saved = await saveGeneration({
              userId: user.id,
              toolSlug: tool.slug,
              stageId: stage.id,
              model,
              input: values,
              contextProfileId: body.contextProfileId ?? null,
              outputLanguage,
              outputMarkdown: full,
            });
            generationId = saved.id;
          }
          if (body.courseId) await linkToCourse(user.id, body.courseId, generationId, body.itemId);
          // The client needs the id to keep the result at a course or a dossier (P27.1).
          return { generationId };
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

/** Links saved work to a course. Never fails the stream: a refusal (not the caller's
 *  course, or an unknown id) is only logged. */
async function linkToCourse(
  userId: string,
  courseId: string,
  generationId: string,
  itemId?: string | null,
) {
  try {
    const link = itemId
      ? await linkGeneration(userId, courseId, generationId, itemId)
      : await linkGeneration(userId, courseId, generationId);
    if (!link) console.warn("Course link refused:", { courseId });
  } catch (e) {
    console.error("Failed to link generation to course:", e);
  }
}
