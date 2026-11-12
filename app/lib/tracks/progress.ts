/** Where a track stands, derived from its data alone (no I/O, no AI). */
import { MILESTONES, type MilestoneId, type TrackData } from "./schema";

interface TrackState {
  data: TrackData;
  closedAt: Date | null;
}

const resolved = (data: TrackData, id: MilestoneId) => {
  const s = data.status[id];
  return s === "done" || s === "skipped";
};

const required = MILESTONES.filter((m) => !m.optional);

export function progress(track: TrackState): { resolved: number; total: number } {
  return {
    resolved: required.filter((m) => resolved(track.data, m.id)).length,
    total: required.length,
  };
}

/** The first required milestone still open, with its hand-in date; null when closed or all resolved. */
export function nextStep(track: TrackState): { milestone: MilestoneId; due: string | null } | null {
  if (track.closedAt) return null;
  const open = required.find((m) => !resolved(track.data, m.id));
  return open ? { milestone: open.id, due: track.data.deadlines[open.id] ?? null } : null;
}
