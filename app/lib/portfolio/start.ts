/**
 * The start wizard of a dossier (step 4 of the guided route): four screens, each with its own
 * address (`?step=`), and every one may be skipped.
 */
export const START_STEPS = ["track", "framework", "anchors", "planning"] as const;
export type StartStep = (typeof START_STEPS)[number];

/** The step a `?step=` value names; anything else is the first. */
export const startStep = (value: string | null): StartStep =>
  START_STEPS.find((s) => s === value) ?? "track";

export const startHref = (dossierId: string, step: StartStep): string =>
  `/portfolio/${encodeURIComponent(dossierId)}/start?step=${step}`;
