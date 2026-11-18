/**
 * "Grill me over het hele dossier": one round of questions over every chapter, the answers
 * typed on one page, and then every chapter drafted from them. It reuses Grill me per chapter
 * (`grillOutcomes`) and drafting per chapter (`draftChapter`) on the same stored questions
 * and answers, so the per-chapter buttons and these can be used in any order.
 */
import { factsBlock } from "~/lib/portfolio/courseFacts";
import { withAnswers, writingSections } from "~/lib/portfolio/guided";
import { LIMITS } from "~/lib/portfolio/schema";
import type { DossierData } from "~/lib/portfolio/types";
import type { Locale } from "~/lib/i18n";
import type { User } from "./auth.server";
import { anchorCourseFacts } from "./dossierAnchors.server";
import {
  draftChapter,
  type GuidedError,
  type GuidedResult,
  PARALLEL,
} from "./portfolioGuided.server";
import { answersFromForm, grillOutcomes } from "./portfolioGuidedRun.server";
import { type Dossier, updateDossier } from "./repositories/portfolio.server";

/** The outcomes with parts to write, in the framework's order. */
const writable = (d: DossierData) =>
  d.framework.outcomes.filter((o) => writingSections(o).length > 0).map((o) => o.id);

/** What each outcome's anchored course already says, "" for an outcome without one. */
async function coursesOf(
  user: User,
  d: DossierData,
  locale: Locale,
): Promise<Record<string, string>> {
  const ids = writable(d);
  const facts = await Promise.all(
    ids.map((id) => anchorCourseFacts(user.id, d.anchors?.[id], locale)),
  );
  return Object.fromEntries(ids.map((id, i) => [id, factsBlock(facts[i]?.facts ?? [], locale)]));
}

/** The answers typed on the dossier page (`answer:<outcomeId>:<sectionId>`), stored. */
function withDossierAnswers(d: DossierData, fd: FormData): DossierData {
  return d.framework.outcomes.reduce(
    (acc, o) => withAnswers(acc, o.id, answersFromForm(fd, `answer:${o.id}:`)),
    d,
  );
}

/** One Grill me round over every chapter of the dossier. */
export function grillDossier(
  user: User,
  d: DossierData,
  locale: Locale,
  now = Date.now(),
  courses: Record<string, string> = {},
): Promise<GuidedResult> {
  return grillOutcomes(user, d, writable(d), locale, now, courses);
}

/** `into` with one outcome's chapter, guided parts and its `drafted` new log lines from `from`. */
function takeChapter(
  into: DossierData,
  from: DossierData,
  outcomeId: string,
  drafted: number,
): DossierData {
  const chapter = from.chapters.find((c) => c.outcomeId === outcomeId);
  const has = into.chapters.some((c) => c.outcomeId === outcomeId);
  const chapters = !chapter
    ? into.chapters
    : has
      ? into.chapters.map((c) => (c.outcomeId === outcomeId ? chapter : c))
      : [...into.chapters, chapter];
  return {
    ...into,
    chapters,
    guided: { ...into.guided, [outcomeId]: { ...from.guided?.[outcomeId] } },
    // Each section written adds one log line, at the end.
    aiLog: [...into.aiLog, ...from.aiLog.slice(-drafted)].slice(-LIMITS.aiLog),
  };
}

/**
 * Every chapter from its answers: a few chapters at a time, each section by section as on its
 * own Chapter tab, after what the chapter already says. `failed` counts the chapters where a
 * part did not work; they keep their own buttons.
 */
export async function draftDossier(
  user: User,
  d: DossierData,
  locale: Locale,
  now = Date.now(),
  courses: Record<string, string> = {},
): Promise<GuidedResult> {
  if (d.coachMode !== "draft") return { ok: false, error: "not-draft-mode" };
  if (d.framework.confirmedAt === undefined) return { ok: false, error: "not-confirmed" };
  const ids = writable(d);
  const text = (id: string) => d.chapters.find((c) => c.outcomeId === id)?.text ?? "";
  let data = d;
  let drafted = 0;
  let failed = 0;
  const errors: GuidedError[] = [];
  for (let i = 0; i < ids.length; i += PARALLEL) {
    const batch = ids.slice(i, i + PARALLEL);
    const results = await Promise.all(
      batch.map((id) =>
        draftChapter(user, d, id, text(id), locale, now, courses[id] ?? "").catch(() => ({
          ok: false as const,
          error: "failed" as const,
        })),
      ),
    );
    results.forEach((r, j) => {
      const id = batch[j];
      if (id === undefined) return;
      if (!r.ok) {
        errors.push(r.error);
        if (r.error === "failed" || r.error === "quota") failed++;
        return;
      }
      data = takeChapter(data, r.data, id, r.drafted ?? 0);
      drafted += r.drafted ?? 0;
      if (r.failed) failed++;
    });
  }
  if (drafted === 0) {
    const first = (["quota", "failed", "no-material"] as const).find((e) => errors.includes(e));
    return { ok: false, error: first ?? "all-drafted" };
  }
  return { ok: true, data, drafted, failed };
}

const INTENTS = ["grillDossier", "draftDossier", "saveDossierAnswers"] as const;
type DossierGrillIntent = (typeof INTENTS)[number];

type DossierGrillActionResult =
  | { ok: true; intent: DossierGrillIntent; drafted?: number; failed?: number; followUps?: number }
  | { ok: false; error: GuidedError | "invalid" };

/**
 * The dossier page's Grill me buttons; `null` for any other intent. The answers typed on the
 * page are kept first, so nothing typed is lost, also when the model fails.
 */
export async function runDossierGrillIntent(
  user: User,
  dossier: Dossier,
  intent: string,
  fd: FormData,
  locale: Locale,
): Promise<DossierGrillActionResult | null> {
  const step = INTENTS.find((i) => i === intent);
  if (!step) return null;
  const typed = withDossierAnswers(dossier.data, fd);
  const store = async (data: DossierData) =>
    (await updateDossier(user.id, dossier.id, { data }).catch(() => null)) !== null;
  if (step === "saveDossierAnswers")
    return (await store(typed)) ? { ok: true, intent: step } : { ok: false, error: "invalid" };
  const courses = await coursesOf(user, typed, locale);
  const run = step === "grillDossier" ? grillDossier : draftDossier;
  const result = await run(user, typed, locale, Date.now(), courses).catch(() => ({
    ok: false as const,
    error: "failed" as const,
  }));
  if (!result.ok) {
    await store(typed);
    return result;
  }
  if (!(await store(result.data))) return { ok: false, error: "invalid" };
  return {
    ok: true,
    intent: step,
    drafted: result.drafted,
    failed: result.failed,
    followUps: result.followUps,
  };
}
