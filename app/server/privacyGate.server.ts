/**
 * The anonymiseerpoort (PR 2, BESLUIT-2026-11-17-5): the only door through which LimeOnIt sends
 * anything to a model or to Jev. `tests/architecture.test.ts` keeps it that way: nothing else
 * imports `providerForModel` or `postDecisions`.
 *
 * Every call goes through the same engine as the browser (`~/lib/privacy/gate`), with the names
 * the app knows (`listKnownPeople`) and the teacher's never-list. A call from a page with the live
 * preview (PR 3: every tool that streams) carries the teacher's approval: the gate replaces what
 * they saw, sends nothing while anything is left they did not see, and puts the names back in the
 * answer. The screens without a typing moment (step 4) run their calls as one round
 * (`withPrivacyRound`) with the approval of the overview the teacher saw. Any other call is only
 * counted. The code table lives only as long as the call; the log line and the counters on the
 * health screen (PR 5) hold counts per kind, never a word. The words the institution keeps (PR 5)
 * are never replaced.
 */
import { AsyncLocalStorage } from "node:async_hooks";
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
import type { PrivacyPage } from "~/lib/privacy/live";
import { log } from "./log.server";
import { recordGateCall } from "./repositories/gateCounts.server";
import { listKeepWords } from "./repositories/keepWords.server";
import { listKnownPeople } from "./repositories/knownPeople.server";
import { listSharedKeepWords } from "./repositories/sharedKeepWords.server";

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
  /** Words the teacher also replaces in text the server holds (step 4, `prepareOverview`). */
  replace: Words.optional(),
});
export type PrivacyApproval = z.infer<typeof PrivacyApprovalSchema>;

/**
 * What a page with a live preview gets (PR 3): the names the gate knows, so the preview shows
 * exactly what the gate will do, the teacher's never-list, and the words the institution keeps
 * (PR 5), apart, since the teacher cannot take those off.
 */
export async function privacyPageFor(user: { id: string }): Promise<PrivacyPage> {
  return {
    known: await listKnownPeople(user.id),
    never: await listKeepWords(user.id),
    shared: await listSharedKeepWords(),
  };
}

export interface GateContext {
  /** Which door, for the count line: the tool stream, the structured call, or Jev. */
  exit: "stream" | "portfolio" | "jev";
  /** The language of the sentence about codes. */
  locale: "nl" | "en";
  approval?: PrivacyApproval | undefined;
}

export type Gated<T> = { ok: true; value: T } | { ok: false; review: ReviewItem[] };

/**
 * A round (step 4): one action of a screen without a typing moment (Bewijs in één keer, the
 * review team, the course import and evaluation), with the approval from the overview the teacher
 * saw. Every call in it is gated with that approval; once one is refused, the rest of the round
 * sends nothing either and only adds its words, so the teacher sees them all at once.
 */
interface Round {
  approval: PrivacyApproval;
  review: Map<string, ReviewItem>;
}
const rounds = new AsyncLocalStorage<Round>();
const NONE: PrivacyApproval = { approved: [], keep: [] };

function parseApproval(raw: unknown): PrivacyApproval {
  if (typeof raw !== "string") return NONE;
  try {
    const parsed = PrivacyApprovalSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : NONE;
  } catch {
    return NONE;
  }
}

/**
 * Runs `work` as one round with the form's `privacy` field. Without a valid approval nothing the
 * teacher did not see goes. `review` holds the words to lay before the teacher, or null.
 */
export async function withPrivacyRound<T>(
  raw: unknown,
  work: () => Promise<T>,
): Promise<{ value: T; review: ReviewItem[] | null }> {
  const round: Round = { approval: parseApproval(raw), review: new Map() };
  const value = await rounds.run(round, work);
  return { value, review: round.review.size > 0 ? [...round.review.values()] : null };
}

/** Whether this call may go: false when the gate or an earlier call in the round refused. */
function mayGo(g: { send: true } | { send: false; review: ReviewItem[] }): boolean {
  const round = rounds.getStore();
  if (!g.send)
    for (const item of g.review) {
      const key = item.value.trim().toLowerCase();
      const had = round?.review.get(key);
      round?.review.set(key, had ? { ...had, count: Math.max(had.count, item.count) } : item);
    }
  return g.send && !(round && round.review.size > 0);
}

function refused(g: { send: true } | { send: false; review: ReviewItem[] }): ReviewItem[] {
  return g.send ? [...(rounds.getStore()?.review.values() ?? [])] : g.review;
}

async function policyFor(user: { id: string }, raw: GateContext): Promise<GatePolicy> {
  const ctx = { ...raw, approval: raw.approval ?? rounds.getStore()?.approval };
  const mode: GateMode = ctx.approval ? "review" : "count";
  // The words the institution keeps hold everywhere, also when only counting (PR 5).
  const shared = await listSharedKeepWords();
  return {
    known: await listKnownPeople(user.id),
    mode,
    keep: shared,
    ...(ctx.approval
      ? {
          approved: ctx.approval.approved,
          // The teacher's never-list holds even when the page did not send it (PR 3).
          keep: [...ctx.approval.keep, ...(await listKeepWords(user.id)), ...shared],
          ...(ctx.approval.studentNumberExample
            ? { studentNumberExample: ctx.approval.studentNumberExample }
            : {}),
          ...(ctx.approval.replace ? { replace: ctx.approval.replace } : {}),
        }
      : {}),
  };
}

/** The log line and the health screen's counters (PR 5): counts per kind, never a word. */
async function count(
  ctx: GateContext,
  mode: GateMode,
  sent: boolean,
  counts: GateCounts,
): Promise<void> {
  log("privacy-gate", { exit: ctx.exit, mode, outcome: sent ? "sent" : "review", counts });
  // A counter that cannot be written never stops a call.
  await recordGateCall(counts, sent).catch(() => {});
}

/** One model call, whole answer. */
export async function gatedGenerate(
  user: { id: string },
  opts: GenerateOptions,
  ctx: GateContext,
): Promise<Gated<GenerateResult>> {
  const policy = await policyFor(user, ctx);
  const g = gatePrompt(opts, policy, ctx.locale);
  const go = mayGo(g);
  await count(ctx, policy.mode, go, g.counts);
  if (!go || !g.send) return { ok: false, review: refused(g) };
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
  const go = mayGo(g);
  await count(ctx, policy.mode, go, g.counts);
  if (!go || !g.send) return { ok: false, review: refused(g) };
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
  const go = mayGo(g);
  await count(ctx, policy.mode, go, g.counts);
  if (!go || !g.send) return { ok: false, review: refused(g) };
  const answer = await postDecisions(url, { ...payload, state: g.value }, opts);
  return { ok: true, value: restoreJson(answer, g.codes) };
}
