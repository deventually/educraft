/**
 * Pilot feedback (teachers rate results and tell how it goes). Pure rules and answer
 * options; storage lives in `app/server/repositories/pilot.server.ts` and
 * `feedback.server.ts`. No AI, no per-tool branches.
 */

/** "How much time did this save?" in minutes; 60 stands for "60 or more". */
export const TIME_SAVED_OPTIONS = [0, 15, 30, 60] as const;
export type MinutesSaved = (typeof TIME_SAVED_OPTIONS)[number];

/** "How good was it?" from 1 (poor) to 5 (excellent). */
export const QUALITY_SCORES = [1, 2, 3, 4, 5] as const;
export type QualityScore = (typeof QUALITY_SCORES)[number];

/** Days between two check-ins (an answer and a "not now" both count). */
export const CHECKIN_INTERVAL_DAYS = 14;
/** Results a teacher has made before the first check-in shows. */
export const CHECKIN_MIN_GENERATIONS = 3;

/** Max length of one check-in answer. */
export const CHECKIN_ANSWER_MAX = 1000;

/** The three check-in questions, as stable keys (the text lives in i18n). */
export const CHECKIN_QUESTIONS = ["helped", "annoyed", "missing"] as const;
export type CheckinQuestion = (typeof CHECKIN_QUESTIONS)[number];

export function checkinDue(args: {
  generationCount: number;
  lastAt: Date | null;
  now: Date;
}): boolean {
  if (args.generationCount < CHECKIN_MIN_GENERATIONS) return false;
  if (!args.lastAt) return true;
  return args.now.getTime() - args.lastAt.getTime() >= CHECKIN_INTERVAL_DAYS * 86_400_000;
}

export interface ToolFeedbackInput {
  toolSlug: string;
  rating: number;
  minutesSaved: number | null;
  quality: number | null;
  comment: string | null;
}

export interface ToolSummary {
  toolSlug: string;
  uses: number;
  up: number;
  down: number;
  /** Sum of the answers; a "60+" counts as 60, so this is a lower bound. */
  minutesSaved: number;
  timeAnswers: number;
  qualityAvg: number | null;
  qualityAnswers: number;
  comments: number;
}

/** One row per tool: how often used, and what teachers said about it. Sorted by uses. */
export function summarizeByTool(
  uses: { toolSlug: string; count: number }[],
  feedback: ToolFeedbackInput[],
): ToolSummary[] {
  const rows = new Map<string, ToolSummary & { qualitySum: number }>();
  const row = (toolSlug: string) => {
    let r = rows.get(toolSlug);
    if (!r) {
      r = {
        toolSlug,
        uses: 0,
        up: 0,
        down: 0,
        minutesSaved: 0,
        timeAnswers: 0,
        qualityAvg: null,
        qualityAnswers: 0,
        comments: 0,
        qualitySum: 0,
      };
      rows.set(toolSlug, r);
    }
    return r;
  };
  for (const u of uses) row(u.toolSlug).uses += u.count;
  for (const f of feedback) {
    const r = row(f.toolSlug);
    if (f.rating > 0) r.up++;
    else if (f.rating < 0) r.down++;
    if (f.minutesSaved !== null) {
      r.minutesSaved += f.minutesSaved;
      r.timeAnswers++;
    }
    if (f.quality !== null) {
      r.qualitySum += f.quality;
      r.qualityAnswers++;
    }
    if (f.comment?.trim()) r.comments++;
  }
  return [...rows.values()]
    .map(({ qualitySum, ...r }) => ({
      ...r,
      qualityAvg: r.qualityAnswers ? Math.round((qualitySum / r.qualityAnswers) * 10) / 10 : null,
    }))
    .sort((a, b) => b.uses - a.uses);
}
