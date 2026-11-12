/**
 * Ready for OnStage (brief P38.7): the criteria of the track's assessment model, a first draft per
 * criterion from the final assessment, and the whole feedback line for Word. Pure; no AI.
 */
import type { Locale } from "~/lib/i18n";
import { loc } from "~/lib/i18n/localized";
import { feedbackHistory } from "./history";
import { MILESTONES } from "./schema";

/** A criterion line: a code such as C1, SC2, LU3 or 1. at the start. */
const CODED = /^([A-Z]{1,4}\d+(\.\d+)*|\d+(\.\d+)*[.)]?)\s/;
/** Longer top-level lines are an introduction, not a criterion. */
const MAX_CRITERION = 160;

/**
 * The criteria of a framework, in its order: the coded top-level lines, or (when none is coded)
 * every short top-level line. Level bullets and indented lines are details of a criterion.
 */
export function criteriaOf(framework: string): string[] {
  const top = framework
    .split("\n")
    .filter((l) => l.trim() && !/^[\s\-*•]/.test(l))
    .map((l) => l.trim().replace(/[.:]$/, ""))
    .filter((l) => l.length <= MAX_CRITERION);
  const coded = top.filter((l) => CODED.test(l));
  return [...new Set(coded.length ? coded : top)];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The text under the heading (or the bold paragraph) of the assessment that names the criterion's
 * code; "" when there is none. C1 never matches C10.
 */
export function draftFor(criterion: string, markdown: string): string {
  const code = criterion.split(/\s/)[0] ?? "";
  if (!code) return "";
  const names = new RegExp(`(^|[^\\w.])${escapeRe(code.replace(/[.)]$/, ""))}(?![\\w])`);
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const heading = /^(#{1,6})\s/.exec(line);
    if (heading && names.test(line)) {
      const level = heading[1]?.length ?? 1;
      const end = lines.findIndex(
        (l, j) => j > i && /^(#{1,6})\s/.test(l) && (/^#+/.exec(l)?.[0].length ?? 7) <= level,
      );
      return lines
        .slice(i + 1, end === -1 ? undefined : end)
        .join("\n")
        .trim();
    }
    if (line.startsWith("**") && names.test(line.slice(0, 80))) {
      const end = lines.findIndex((l, j) => j > i && !l.trim());
      return lines
        .slice(i, end === -1 ? undefined : end)
        .join("\n")
        .trim();
    }
  }
  return "";
}

interface LineInput {
  rounds: readonly { milestone: string; round: number; feedback: { text: string } }[];
  onstage: readonly { criterion: string; text: string }[];
}

/** The whole line of a track for Word: every round, oldest first, then the confirmed texts. */
export function trackLine({ rounds, onstage }: LineInput, locale: Locale): string {
  const blocks = [feedbackHistory(rounds, locale, Number.POSITIVE_INFINITY)];
  const confirmed = onstage.filter((c) => c.text.trim());
  if (confirmed.length) {
    const name = MILESTONES.find((m) => m.id === "onstage")?.name;
    blocks.push(
      [
        `## ${name ? loc(name, locale) : "OnStage"}`,
        ...confirmed.map((c) => `### ${c.criterion}\n${c.text.trim()}`),
      ].join("\n\n"),
    );
  }
  return blocks.filter(Boolean).join("\n\n");
}
