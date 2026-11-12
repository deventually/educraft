/**
 * How long a closed track is kept (P38, principle 4): the admin sets the days; 90 is a
 * provisional default for an objection period until the privacy officer confirms the term.
 */
export const TRACK_RETENTION = { defaultDays: 90, maxDays: 3650 } as const;

const DAY = 24 * 60 * 60 * 1000;

/** When a track closed on `closedAt` is wiped. */
export function purgeDate(closedAt: Date, days: number): Date {
  return new Date(closedAt.getTime() + days * DAY);
}
