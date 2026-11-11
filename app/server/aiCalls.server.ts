/**
 * AI actions without streaming (Reviewteam, coach, proofread, framework and course import)
 * that the teacher can stop. The page sends a call id with the form; when the teacher
 * leaves and picks "Stop", the page cancels that id (`/api/ai-cancel`). Leaving alone does
 * not stop the work: "Keep running" lets the action finish and save its result.
 *
 * The signal travels with the async context, so `callPortfolioModel` finds it without
 * every action passing it along. One process serves the app (SQLite), so memory is enough.
 */
import { AsyncLocalStorage } from "node:async_hooks";

const CALL_ID = /^[A-Za-z0-9-]{8,64}$/;
/** How long a cancel that arrived before its call is remembered. */
const EARLY_CANCEL_MS = 60_000;
const EARLY_CANCEL_MAX = 1_000;

const context = new AsyncLocalStorage<AbortSignal>();
const running = new Map<string, AbortController>();
const cancelledEarly = new Map<string, number>();

const keyOf = (userId: string, callId: string) => `${userId}\u0000${callId}`;

/** A call id the page may send: anything else is ignored. */
export function isAiCallId(value: unknown): value is string {
  return typeof value === "string" && CALL_ID.test(value);
}

/** The signal of the AI action this code runs in, if the page sent a call id. */
export function currentAiSignal(): AbortSignal | undefined {
  return context.getStore();
}

/** Runs `work` as the teacher's call `callId`, so `cancelAiCall` can stop its model calls. */
export async function runAiCall<T>(
  userId: string,
  callId: unknown,
  work: () => Promise<T>,
): Promise<T> {
  if (!isAiCallId(callId)) return work();
  const key = keyOf(userId, callId);
  const ctrl = new AbortController();
  if (cancelledEarly.delete(key)) ctrl.abort();
  running.set(key, ctrl);
  try {
    return await context.run(ctrl.signal, work);
  } finally {
    if (running.get(key) === ctrl) running.delete(key);
  }
}

/** Stops the teacher's own call `callId`; a cancel ahead of its call is kept for a minute. */
export function cancelAiCall(userId: string, callId: string): void {
  if (!isAiCallId(callId)) return;
  const key = keyOf(userId, callId);
  const ctrl = running.get(key);
  if (ctrl) {
    ctrl.abort();
    return;
  }
  const now = Date.now();
  for (const [k, at] of cancelledEarly) {
    if (now - at > EARLY_CANCEL_MS || cancelledEarly.size >= EARLY_CANCEL_MAX) {
      cancelledEarly.delete(k);
    }
  }
  cancelledEarly.set(key, now);
}
