import { Button, HelpText, Label, Textarea } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import type { Messages } from "~/lib/i18n/messages/nl";
import { useT } from "~/lib/i18n/useT";
import type { GuidedSectionView } from "~/lib/portfolio/guided";
import { listOf } from "./ChapterOutline";

type GuidedMessages = Messages["portfolioGuided"];

/** The waiting toast for a guided-writing intent (`guide…`). */
export function guidedPending(intent: string, t: GuidedMessages): string {
  if (intent === "guideQuestionsAll") return t.pendingQuestionsAll;
  if (intent === "guideDraftAll") return t.pendingChapter;
  return intent.startsWith("guideDraft") ? t.pendingDraft : t.pendingQuestions;
}

/** The done toast for a guided-writing intent, saying how many parts did not work. */
export function guidedDone(
  r: { intent: string; drafted?: number; failed?: number },
  t: GuidedMessages,
): string {
  const done =
    r.intent === "guideDraftAll"
      ? r.drafted === 1
        ? t.chapterDoneOne
        : fmt(t.chapterDone, { n: r.drafted ?? 0 })
      : r.intent === "guideQuestionsAll"
        ? t.questionsAll
        : r.intent === "guideDraft"
          ? t.done
          : t.questions;
  return r.failed ? `${done} ${fmt(t.partlyFailed, { n: r.failed })}` : done;
}

const CARD = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

/**
 * Guided writing per section (BDB/BKE plan, step 6), on the chapter tab, inside the chapter's
 * form: saving the chapter keeps the answers too, and every button here posts the chapter text,
 * so nothing typed is lost. The coach asks questions per section, or for all of them at once,
 * so the teacher answers the whole chapter on one screen; in draft mode the answers become a
 * paragraph per section, or the whole chapter section by section, otherwise they stay beside
 * the editor as notes.
 */
export function GuidedWriting({
  sections,
  draftMode,
}: {
  sections: GuidedSectionView[];
  draftMode: boolean;
}) {
  const t = useT().portfolioGuided;
  const to = useT().portfolioOutline;
  if (sections.length === 0) return null;
  const askAll = sections.some((s) => s.questions.length === 0);
  const writeAll = draftMode && sections.some((s) => s.questions.length > 0 && !s.drafted);
  return (
    <section className="mt-3" aria-labelledby="guided-title">
      <h3 id="guided-title" className="text-base font-medium text-slate-900">
        {t.title}
      </h3>
      <p className="mt-1 text-sm text-slate-600">{t.intro}</p>
      {!draftMode && <p className="mt-1 text-sm text-slate-600">{t.coachModeNote}</p>}
      {askAll && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            name="intent"
            value="guideQuestionsAll"
            variant="secondary"
            aria-describedby="guided-ask-all-hint"
          >
            {t.askAll}
          </Button>
          <HelpText id="guided-ask-all-hint">{t.askAllHint}</HelpText>
        </div>
      )}
      <ol className="mt-3 space-y-3">
        {sections.map((s) => {
          const name = s.fromOutline ? s.title : fmt(t.criterion, { n: s.n });
          const hintId = `guided-hint-${s.id}`;
          const unanswered = s.answers.every((a) => !a.trim());
          return (
            <li key={s.id} className={CARD}>
              <h4 className="font-medium text-slate-900">{name}</h4>
              {!s.fromOutline && <p className="mt-1 text-sm text-slate-700">{s.title}</p>}
              {s.description && <p className="mt-1 text-sm text-slate-700">{s.description}</p>}
              {s.fromOutline && s.covers.length > 0 && (
                <p className="mt-1 text-sm text-slate-600">
                  {s.covers.length === 1
                    ? fmt(to.coversOne, { n: listOf(s.covers, to.and) })
                    : fmt(to.coversMany, { list: listOf(s.covers, to.and) })}
                </p>
              )}
              {s.unverified && (
                <p className="mt-1 text-sm font-medium text-amber-800">{to.check}</p>
              )}
              {s.drafted && <p className="mt-1 text-sm text-slate-600">{t.drafted}</p>}

              {s.questions.length > 0 && (
                <div className="mt-3 grid gap-3">
                  <HelpText id={hintId}>{t.answerHint}</HelpText>
                  {s.questions.map((q, i) => {
                    const id = `guided-${s.id}-${i}`;
                    return (
                      <div key={id} className="grid gap-1">
                        <Label htmlFor={id}>{q}</Label>
                        <Textarea
                          id={id}
                          name={`answer:${s.id}`}
                          rows={3}
                          defaultValue={s.answers[i] ?? ""}
                          aria-describedby={hintId}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {s.questions.length > 0 && draftMode && (
                  <Button
                    type="submit"
                    name="intent"
                    value={`guideDraft:${s.id}`}
                    size="sm"
                    aria-label={fmt(t.draftLabel, { title: name })}
                  >
                    {t.draft}
                  </Button>
                )}
                {(s.questions.length === 0 || unanswered) && (
                  <Button
                    type="submit"
                    name="intent"
                    value={`guideQuestions:${s.id}`}
                    variant="secondary"
                    size="sm"
                    aria-label={fmt(s.questions.length === 0 ? t.askLabel : t.askAgainLabel, {
                      title: name,
                    })}
                  >
                    {s.questions.length === 0 ? t.ask : t.askAgain}
                  </Button>
                )}
              </div>
              {s.questions.length > 0 && draftMode && (
                <p className="mt-2 text-sm text-slate-600">{t.draftHint}</p>
              )}
            </li>
          );
        })}
      </ol>
      {writeAll && (
        <div className="mt-3 grid gap-2">
          <div>
            <Button
              type="submit"
              name="intent"
              value="guideDraftAll"
              aria-describedby="guided-chapter-hint"
            >
              {t.chapter}
            </Button>
          </div>
          <HelpText id="guided-chapter-hint">{t.chapterHint}</HelpText>
        </div>
      )}
    </section>
  );
}
