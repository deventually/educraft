/**
 * Tiny dependency-free structured logger. Emits one JSON line per event to
 * stdout, which Docker/hosts collect. Callers pass **metadata only** — never
 * prompt or response content (student data stays out of logs by construction;
 * the logger simply serializes whatever fields it is handed).
 *
 * Shape: {"ts":"<ISO>","event":"<name>",...fields}
 */
export function log(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}
