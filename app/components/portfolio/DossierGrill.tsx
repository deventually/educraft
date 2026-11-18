import { useEffect, useRef } from "react";
import { Form, Link } from "react-router";
import { AiCallField } from "~/components/AiLeaveGuard";
import { Button, HelpText } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import type { Messages } from "~/lib/i18n/messages/nl";
import { useT } from "~/lib/i18n/useT";
import type { DossierGrillOutcome } from "~/lib/portfolio/dossierGrill";
import { outcomeHref } from "~/lib/portfolio/tabs";
import { DictatedAnswer } from "./DictatedAnswer";

type GrillMessages = Messages["portfolioGrill"];
type GuidedMessages = Messages["portfolioGuided"];

/** The waiting toast for a dossier Grill me intent; `null` for saving the answers. */
export function grillPending(intent: string, t: GrillMessages): string | null {
  if (intent === "grillDossier") return t.pendingGrill;
  if (intent === "draftDossier") return t.pendingDraft;
  return null;
}

/** The done toast for a dossier Grill me intent, saying what did not work. */
export function grillDone(
  r: { intent: string; drafted?: number; failed?: number; followUps?: number },
  t: GrillMessages,
  g: GuidedMessages,
): string {
  const failed = r.failed ?? 0;
  if (r.intent === "grillDossier") {
    const done = r.followUps ? fmt(t.grillDone, { n: r.followUps }) : t.grillNone;
    return failed ? `${done} ${fmt(g.partlyFailed, { n: failed })}` : done;
  }
  if (r.intent === "draftDossier") {
    const done = r.drafted === 1 ? t.draftDoneOne : fmt(t.draftDone, { n: r.drafted ?? 0 });
    if (!failed) return done;
    return `${done} ${fmt(failed === 1 ? t.partlyFailed : t.partlyFailedMany, { n: failed })}`;
  }
  return t.saved;
}

const CARD = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

/**
 * "Grill me over het hele dossier", the Write tab of a dossier: one button runs Grill me over
 * every learning outcome, the questions stand in one list per outcome, and in draft mode one
 * more button drafts every chapter from the answers. It shows the same stored questions as each
 * chapter's own Grill me, so the teacher can switch between them at will.
 */
export function DossierGrill({
  dossierId,
  outcomes,
  confirmed,
  draftMode,
  focusAfter,
}: {
  dossierId: string;
  outcomes: DossierGrillOutcome[];
  confirmed: boolean;
  draftMode: boolean;
  /** The intent of the post that just remounted this block, if any. */
  focusAfter?: string;
}) {
  const t = useT().portfolioGrill;
  const g = useT().portfolioGuided;
  const form = useRef<HTMLFormElement>(null);
  // Only on mount (WCAG 2.4.3): after new questions, the first empty answer; else the button.
  const mountedAfter = useRef(focusAfter);
  useEffect(() => {
    const intent = mountedAfter.current;
    const el = form.current;
    if (!intent || !el) return;
    const open =
      intent === "grillDossier"
        ? [...el.querySelectorAll<HTMLTextAreaElement>('textarea[name^="answer:"]')].find(
            (a) => !a.value.trim(),
          )
        : undefined;
    (open ?? el.querySelector<HTMLElement>(`button[value="${CSS.escape(intent)}"]`))?.focus();
  }, []);
  return (
    <section className="mt-8" aria-labelledby="grill-title">
      <h2 id="grill-title" className="text-lg font-medium text-slate-900">
        {t.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t.intro}</p>
      {!confirmed ? (
        <p className="mt-3 text-sm text-slate-700">
          {t.notConfirmed}{" "}
          <Link
            to={`/portfolio/${encodeURIComponent(dossierId)}/framework`}
            className="font-medium text-violet-700 underline underline-offset-2"
          >
            {t.notConfirmedLink}
          </Link>
        </p>
      ) : (
        <Form ref={form} method="post" className="mt-3 grid gap-4">
          <AiCallField />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" name="intent" value="grillDossier" aria-describedby="grill-hint">
              {t.grill}
            </Button>
            <HelpText id="grill-hint">{t.grillHint}</HelpText>
          </div>
          <HelpText id="grill-answer-hint">{t.answerHint}</HelpText>
          {outcomes.map((o) => {
            const asked = o.sections.filter((s) => s.questions.length > 0);
            return (
              <section key={o.outcomeId} className={CARD} aria-labelledby={`grill-${o.outcomeId}`}>
                <h3 id={`grill-${o.outcomeId}`} className="font-medium text-slate-900">
                  {o.label}
                </h3>
                {asked.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-600">{t.noQuestions}</p>
                ) : (
                  <ol className="mt-3 space-y-4">
                    {asked.map((s) => {
                      const name = s.fromOutline ? s.title : fmt(g.criterion, { n: s.n });
                      return (
                        <li key={s.id}>
                          <h4 className="text-sm font-medium text-slate-900">{name}</h4>
                          {!s.fromOutline && (
                            <p className="mt-1 text-sm text-slate-700">{s.title}</p>
                          )}
                          {s.drafted && <p className="mt-1 text-sm text-slate-600">{g.drafted}</p>}
                          <div className="mt-2 grid gap-3">
                            {s.questions.map((q, i) => {
                              const id = `grill-${o.outcomeId}-${s.id}-${i}`;
                              return (
                                <DictatedAnswer
                                  key={id}
                                  id={id}
                                  question={q}
                                  name={`answer:${o.outcomeId}:${s.id}`}
                                  defaultValue={s.answers[i] ?? ""}
                                  describedBy="grill-answer-hint"
                                />
                              );
                            })}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
                <Link
                  to={outcomeHref(dossierId, o.outcomeId, "chapter")}
                  className="mt-3 inline-block text-sm font-medium text-violet-700 underline underline-offset-2"
                >
                  {fmt(t.toChapter, { outcome: o.label })}
                </Link>
              </section>
            );
          })}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" name="intent" value="saveDossierAnswers" variant="secondary">
              {t.save}
            </Button>
          </div>
          {draftMode ? (
            <div className="grid gap-2">
              <div>
                <Button
                  type="submit"
                  name="intent"
                  value="draftDossier"
                  aria-describedby="grill-draft-hint"
                >
                  {t.draft}
                </Button>
              </div>
              <HelpText id="grill-draft-hint">{t.draftHint}</HelpText>
            </div>
          ) : (
            <p className="text-sm text-slate-600">{t.coachModeNote}</p>
          )}
        </Form>
      )}
    </section>
  );
}
