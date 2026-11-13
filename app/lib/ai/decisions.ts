/**
 * The Decisions API of a provider (OpenRouter's, for TypeSafe's Jev): typed questions about a
 * state in, a probability or a choice per question out. One POST; the server half
 * (`app/server/courseImport.server.ts`) chooses the key, meters the cost and decides what to do
 * with a failure.
 */

/** A request: the pinned model, the state Jev reads, and named questions about it. */
export interface DecisionsPayload {
  model: string;
  state: unknown;
  questions: Record<string, unknown>;
}

/** Sends `payload` to `url` with the key; throws with the status on an error. */
export async function postDecisions(
  url: string,
  payload: DecisionsPayload,
  opts: { apiKey: string; signal?: AbortSignal; fetch?: typeof fetch },
): Promise<unknown> {
  const res = await (opts.fetch ?? fetch)(url, {
    method: "POST",
    headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
  if (!res.ok) throw new Error(`Decisions API: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as unknown;
}
