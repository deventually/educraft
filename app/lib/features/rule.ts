/**
 * The on/off rule (P28.3, BESLUIT-2026-11-05-5). Pure: no I/O, no feature names.
 *
 *   effective = instance is Off           → off
 *             | the teacher has an exception → that exception
 *             | one of their teams says on  → on
 *             | one of their teams says off → off
 *             | otherwise                   → the instance default
 */

/** The instance stand: Off (nobody), On (default on), On request (default off). */
export type InstanceStand = "off" | "on" | "request";
export const INSTANCE_STANDS: readonly InstanceStand[] = ["off", "on", "request"];

/** A team's choice or a teacher's exception; absent = no choice. */
export type Choice = "on" | "off";
const CHOICES: readonly Choice[] = ["on", "off"];

/**
 * Where an effective stand comes from (shown on the person page). `admin`: an admin
 * has everything the instance has not Off (the rule below is for teachers).
 */
export type Decision =
  | { on: boolean; source: "instance" | "exception" | "default" | "admin" }
  | { on: boolean; source: "team"; team: string };

export function decide(
  instance: InstanceStand,
  teams: { name: string; choice?: Choice }[],
  exception?: Choice,
): Decision {
  if (instance === "off") return { on: false, source: "instance" };
  if (exception) return { on: exception === "on", source: "exception" };
  const yes = teams.find((t) => t.choice === "on");
  if (yes) return { on: true, source: "team", team: yes.name };
  const no = teams.find((t) => t.choice === "off");
  if (no) return { on: false, source: "team", team: no.name };
  return { on: instance === "on", source: "default" };
}

export const isInstanceStand = (v: unknown): v is InstanceStand =>
  typeof v === "string" && (INSTANCE_STANDS as readonly string[]).includes(v);
export const isChoice = (v: unknown): v is Choice =>
  typeof v === "string" && (CHOICES as readonly string[]).includes(v);
