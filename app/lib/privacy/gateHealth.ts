/**
 * The anonymiseerpoort on the health screen (PR 5): per kind how often the gate found something in
 * the last seven days and the seven before, counts only. Computed by `gateCounts.server.ts`, shown
 * by `HealthPanel`.
 */
import type { GateKind } from "./gate";

/** The order of the rows on the health screen: people first, then patterns. */
export const GATE_KINDS: readonly GateKind[] = [
  "teacher",
  "colleague",
  "email",
  "phone",
  "iban",
  "postcode",
  "number",
];

/** The window of one column, in days. */
export const GATE_WINDOW_DAYS = 7;

export interface GateKindHealth {
  kind: GateKind;
  recent: number;
  previous: number;
  spike: boolean;
}

export interface GateHealth {
  /** Calls through the gate in the last seven days. */
  calls: number;
  /** Of those, the calls the gate held back to ask the teacher first. */
  stopped: number;
  kinds: GateKindHealth[];
}

/**
 * A kind goes off far more often: at least 20 times this week and three times last week. Not when
 * last week had no calls at all (a first week), since there is nothing to compare with.
 */
export function isSpike(c: { recent: number; previous: number; previousCalls: number }): boolean {
  return c.previousCalls > 0 && c.recent >= 20 && c.recent >= 3 * c.previous;
}
