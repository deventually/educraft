/**
 * The anonymiseerpoort (PR 2, BESLUIT-2026-11-17-5): the only door through which LimeOnIt sends
 * anything to a model or to Jev. `tests/architecture.test.ts` keeps it that way: nothing else
 * imports `providerForModel` or `postDecisions`.
 *
 * Every call goes through the same engine as the browser (`~/lib/privacy/gate`), with the names
 * the app knows (`listKnownPeople`). Until a screen lays the replacements before the teacher
 * (steps 3 and 4), a call carries no approval and the gate only counts. With an approval it
 * replaces what the teacher saw, sends nothing while anything is left they did not see, and puts
 * the names back in the answer. The code table lives only as long as the call; the log line
 * holds counts per kind, never a word.
 */
import { z } from "zod";
import { type DecisionsPayload, postDecisions } from "~/lib/ai/decisions";
import { providerForModel } from "~/lib/ai/provider";
import type { GenerateOptions, GenerateResult } from "~/lib/ai/types";
import {
  type GateCounts,
  type GateMode,
  type GatePolicy,
  gateJson,
  gatePrompt,
  type ReviewItem,
  restoreJson,
  restoreStream,
} from "~/lib/privacy/gate";
import { restoreNames } from "~/lib/privacy/redact";
import { log } from "./log.server";
import { listKnownPeople } from "./repositories/knownPeople.server";

const Words = z.array(z.string().max(200)).max(500);

/**
 * What the teacher saw in the preview and chose, sent along with the request: the values they
 * saw replaced, the words they chose to keep, and an example student number. Validated at the
 * boundary (`/api/stream`).
 */
export const PrivacyApprovalSchema = z.object({
  approved: Words,
  keep: Words,
  studentNumberExample: z.string().max(30).optional(),
});
export type PrivacyApproval = z.infer<typeof PrivacyApprovalSchema>;

export interface GateContext {
  /** Which door, for the count line: the tool stream, the structured call, or Jev. */
  exit: "stream" | "portfolio" | "jev";
  /** The language of the sentence about codes. */
  locale: "nl" | "en";
  approval?: PrivacyApproval | undefined;
}

export type Gated<T> = { ok: true; value: T } | { ok: false; review: ReviewItem[] };

async function policyFor(user: { id: string }, ctx: GateContext): Promise<GatePolicy> {
  const mode: GateMode = ctx.approval ? "review" : "count";
  return {
    known: await listKnownPeople(user.id),
    mode,
    ...(ctx.approval
      ? {
          approved: ctx.approval.approved,
          keep: ctx.approval.keep,
          ...(ctx.approval.studentNumberExample
            ? { studentNumberExample: ctx.approval.studentNumberExample }
            : {}),
        }
      : {}),
  };
}

function count(ctx: GateContext, mode: GateMode, sent: boolean, counts: GateCounts): void {
  log("privacy-gate", { exit: ctx.exit, mode, outcome: sent ? "sent" : "review", counts });
}

/** One model call, whole answer. */
export async function gatedGenerate(
  user: { id: string },
  opts: GenerateOptions,
  ctx: GateContext,
): Promise<Gated<GenerateResult>> {
  const policy = await policyFor(user, ctx);
  const g = gatePrompt(opts, policy, ctx.locale);
  count(ctx, policy.mode, g.send, g.counts);
  if (!g.send) return { ok: false, review: g.review };
  const result = await providerForModel(opts.model).generate({
    ...opts,
    system: g.system,
    messages: g.messages,
  });
  return { ok: true, value: { ...result, text: restoreNames(result.text, g.codes) } };
}

/** One streamed model call; the names come back chunk by chunk. */
export async function gatedStream(
  user: { id: string },
  opts: GenerateOptions,
  ctx: GateContext,
): Promise<Gated<AsyncIterable<string>>> {
  const policy = await policyFor(user, ctx);
  const g = gatePrompt(opts, policy, ctx.locale);
  count(ctx, policy.mode, g.send, g.counts);
  if (!g.send) return { ok: false, review: g.review };
  const tokens = providerForModel(opts.model).streamChat({
    ...opts,
    system: g.system,
    messages: g.messages,
  });
  return { ok: true, value: restoreStream(tokens, g.codes) };
}

/** One question to Jev: every string in its state is gated, every string in its answer restored. */
export async function gatedDecisions(
  user: { id: string },
  url: string,
  payload: DecisionsPayload,
  opts: Parameters<typeof postDecisions>[2],
  ctx: GateContext,
): Promise<Gated<unknown>> {
  const policy = await policyFor(user, ctx);
  const g = gateJson(payload.state, policy);
  count(ctx, policy.mode, g.send, g.counts);
  if (!g.send) return { ok: false, review: g.review };
  const answer = await postDecisions(url, { ...payload, state: g.value }, opts);
  return { ok: true, value: restoreJson(answer, g.codes) };
}
