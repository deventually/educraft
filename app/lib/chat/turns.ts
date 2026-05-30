/**
 * Pure reducers for a chat thread's turns.
 *
 * These are deliberately immutable. ChatView feeds streamed tokens through
 * `setTurns`, and React Router's default client entry wraps the app in
 * <StrictMode>, which double-invokes state updaters in development to surface
 * impurity. A mutating updater (`lastTurn.content += token`) would therefore
 * append every token twice, producing the duplicated / garbled output we want
 * to avoid. Keeping these functions pure makes the updaters idempotent and the
 * rendered text faithful to the (clean) server stream.
 */

export interface Turn {
  role: "user" | "assistant";
  content: string;
  id: string;
  interrupted?: boolean;
}

/** Return a new turns array with `token` appended to the last turn's content. */
export function appendTokenToLastTurn(turns: Turn[], token: string): Turn[] {
  if (turns.length === 0) return turns;
  const last = turns[turns.length - 1];
  return [...turns.slice(0, -1), { ...last, content: last.content + token }];
}

/** Return a new turns array with the last turn flagged as interrupted. */
export function markLastTurnInterrupted(turns: Turn[]): Turn[] {
  if (turns.length === 0) return turns;
  const last = turns[turns.length - 1];
  if (last.interrupted) return turns;
  return [...turns.slice(0, -1), { ...last, interrupted: true }];
}
