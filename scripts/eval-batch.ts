/**
 * Message Batches for the eval harness (`npm run eval -- --batch`). Batched requests
 * cost half as much (Anthropic Message Batches API); an eval run waits anyway, so the
 * longer turnaround (usually well under an hour) costs nothing.
 *
 * {@link createBatchingProvider} is a drop-in LLMProvider: every `generate()` call is
 * queued, and once no new call has arrived for `idleMs` the whole queue goes out as one
 * batch. The harness runs all cases and runs concurrently, so every first stage lands in
 * one batch, every second stage in the next, and every judge call in the one after that.
 * The request matches what the app's AI SDK adapter sends (same model id, system prompt,
 * messages, output budget, and temperature only where the model accepts it; the same
 * anthropic-version 2023-06-01), so a batched measurement measures the app.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, GenerateOptions, GenerateResult, ImageInput, LLMProvider } from "~/lib/ai/types";
import { outputTokenBudget, resolveModelInfo } from "~/lib/ai/models";

/** Same default as the AI SDK adapter. */
const DEFAULT_TEMPERATURE = 0.4;

/**
 * Models that reject sampling parameters. The AI SDK (@ai-sdk/anthropic,
 * getModelCapabilities → rejectsSamplingParameters) drops `temperature` for these with
 * a warning, so the app never sends it; the API answers a 400 when it is sent anyway.
 * Mirror that list, so a batched request is the request the app makes.
 */
const REJECTS_SAMPLING = ["claude-opus-4-8", "claude-opus-4-7", "claude-fable-5", "claude-sonnet-5"];

export function rejectsTemperature(apiId: string): boolean {
  return REJECTS_SAMPLING.some((prefix) => apiId.includes(prefix));
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export interface BatchParams {
  model: string;
  system: string;
  messages: { role: ChatMessage["role"]; content: string | ContentBlock[] }[];
  temperature?: number;
  max_tokens: number;
}

export interface BatchRequest {
  custom_id: string;
  params: BatchParams;
}

/** One request's outcome, already reduced to what the harness needs. */
export type BatchOutcome =
  | { ok: true; text: string; stopReason: string | null; usage?: { input: number; output: number } }
  | { ok: false; error: string };

/** Sends one batch and resolves with every request's outcome by custom_id. */
export type SubmitBatch = (requests: BatchRequest[]) => Promise<Map<string, BatchOutcome>>;

/** The Messages API params for a provider call, as the AI SDK adapter would send them. */
export function toBatchParams(opts: GenerateOptions): BatchParams {
  const info = resolveModelInfo(opts.model);
  if (info.provider !== "anthropic") {
    throw new Error(`--batch only works with Anthropic models, not "${opts.model}".`);
  }
  const last = opts.messages.length - 1;
  return {
    model: info.apiId,
    system: opts.system,
    messages: opts.messages.map((m, i) =>
      m.role === "user" && i === last && opts.images?.length
        ? { role: m.role, content: [{ type: "text", text: m.content }, ...opts.images.map(imageBlock)] }
        : { role: m.role, content: m.content },
    ),
    ...(rejectsTemperature(info.apiId) ? {} : { temperature: opts.temperature ?? DEFAULT_TEMPERATURE }),
    max_tokens: outputTokenBudget(info, opts.maxTokens),
  };
}

function imageBlock(img: ImageInput): ContentBlock {
  return { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.dataBase64 } };
}

/** "max_tokens" is the API's word for what the AI SDK calls "length" (cut off). */
export function toGenerateResult(outcome: Extract<BatchOutcome, { ok: true }>): GenerateResult {
  return {
    text: outcome.text,
    usage: outcome.usage,
    finishReason: outcome.stopReason === "max_tokens" ? "length" : (outcome.stopReason ?? undefined),
  };
}

/** Reduce one line of the batch results to a {@link BatchOutcome}. */
export function outcomeFromResult(result: {
  type: string;
  message?: { content: { type: string; text?: string }[]; stop_reason: string | null; usage?: { input_tokens: number; output_tokens: number } };
  error?: { error?: { type?: string; message?: string }; type?: string };
}): BatchOutcome {
  if (result.type === "succeeded" && result.message) {
    const text = result.message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const u = result.message.usage;
    return {
      ok: true,
      text,
      stopReason: result.message.stop_reason,
      usage: u ? { input: u.input_tokens, output: u.output_tokens } : undefined,
    };
  }
  const detail = result.error?.error?.message ?? result.error?.error?.type ?? result.error?.type;
  return { ok: false, error: `batch request ${result.type}${detail ? `: ${detail}` : ""}` };
}

interface Pending {
  request: BatchRequest;
  resolve: (r: GenerateResult) => void;
  reject: (e: Error) => void;
}

/** An LLMProvider that collects concurrent `generate()` calls into batches. */
export function createBatchingProvider(submit: SubmitBatch, idleMs = 2000): LLMProvider & { batches: () => number } {
  let queue: Pending[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let next = 0;
  let sent = 0;

  const flush = async () => {
    timer = undefined;
    const pending = queue;
    queue = [];
    if (pending.length === 0) return;
    sent++;
    try {
      const outcomes = await submit(pending.map((p) => p.request));
      for (const p of pending) {
        const o = outcomes.get(p.request.custom_id);
        if (!o) p.reject(new Error(`batch returned no result for ${p.request.custom_id}`));
        else if (o.ok) p.resolve(toGenerateResult(o));
        else p.reject(new Error(o.error));
      }
    } catch (err) {
      for (const p of pending) p.reject(err as Error);
    }
  };

  return {
    id: "anthropic-batch",
    batches: () => sent,
    generate(opts) {
      return new Promise<GenerateResult>((resolve, reject) => {
        let params: BatchParams;
        try {
          params = toBatchParams(opts);
        } catch (err) {
          reject(err as Error);
          return;
        }
        queue.push({ request: { custom_id: `r${next++}`, params }, resolve, reject });
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, idleMs);
      });
    },
    // biome-ignore lint/correctness/useYield: batches have no streaming; the harness never streams.
    async *streamChat() {
      throw new Error("The batching provider does not stream.");
    },
  };
}

/** Submit through the Anthropic Message Batches API and wait for the results. */
export function anthropicSubmit(apiKey: string, pollMs = 30_000): SubmitBatch {
  const client = new Anthropic({ apiKey });
  return async (requests) => {
    const batch = await client.messages.batches.create({
      requests: requests as Anthropic.Messages.BatchCreateParams.Request[],
    });
    console.log(`  · batch ${batch.id}: ${requests.length} requests sent (half price)…`);
    let status = batch;
    while (status.processing_status !== "ended") {
      await new Promise((r) => setTimeout(r, pollMs));
      status = await client.messages.batches.retrieve(batch.id);
      const c = status.request_counts;
      console.log(`  · batch ${batch.id}: ${c.succeeded + c.errored + c.expired + c.canceled}/${requests.length} done`);
    }
    const outcomes = new Map<string, BatchOutcome>();
    for await (const line of await client.messages.batches.results(batch.id)) {
      outcomes.set(line.custom_id, outcomeFromResult(line.result as Parameters<typeof outcomeFromResult>[0]));
    }
    return outcomes;
  };
}
