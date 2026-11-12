/**
 * The feedback line of a track (brief P38.4): the earlier feedback of every round, oldest first,
 * under its milestone and round. The final assessment gets it as `{{feedbackHistory}}`. Pure.
 */
import type { Locale } from "~/lib/i18n";
import { loc } from "~/lib/i18n/localized";
import { MILESTONES } from "./schema";

/** Characters of history sent along; when longer, the oldest rounds go first. */
export const HISTORY_LIMIT = 16_000;

interface HistoryRound {
  milestone: string;
  round: number;
  feedback: { text: string; points?: readonly { criterion: string; text: string }[] };
}

/**
 * The weak points to rehearse (P38.6): the improvement points of the newest round that has
 * them (a feedforward round), one per line, after their criterion. "" without any.
 */
export function weakPoints(rounds: readonly HistoryRound[]): string {
  const last = [...rounds].reverse().find((r) => r.feedback.points?.length);
  return (last?.feedback.points ?? []).map((p) => `- ${p.criterion}: ${p.text}`).join("\n");
}

export function feedbackHistory(rounds: readonly HistoryRound[], locale: Locale): string {
  const word = locale === "en" ? "round" : "ronde";
  const blocks = rounds
    .filter((r) => r.feedback.text.trim())
    .map((r) => {
      const name = MILESTONES.find((m) => m.id === r.milestone)?.name;
      const title = name ? loc(name, locale) : r.milestone;
      return `### ${title}, ${word} ${r.round}\n${r.feedback.text.trim()}`;
    });
  // Newest first while it fits, then back in order.
  const kept: string[] = [];
  let size = 0;
  for (const b of [...blocks].reverse()) {
    const next = size + b.length + (kept.length ? 2 : 0);
    if (next > HISTORY_LIMIT) break;
    kept.unshift(b);
    size = next;
  }
  return kept.join("\n\n");
}
