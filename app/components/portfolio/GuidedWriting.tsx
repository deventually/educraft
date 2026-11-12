import { Button, HelpText } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import type { WritingSection } from "~/lib/portfolio/guided";
import { listOf } from "./ChapterOutline";
import { DictatedAnswer } from "./DictatedAnswer";

/** One part of the chapter as the page shows it: the section, its questions and the answers. */
export interface GuidedSectionView extends WritingSection {
  /** 1-based numbers of the criteria it covers. */
  covers: number[];
  questions: string[];
  answers: string[];
}

const CARD = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

/**
 * Guided writing per section (BDB/BKE plan, step 6), on the chapter tab, inside the chapter's
 * form: saving the chapter keeps the answers too, and every button here posts the chapter text,
 * so nothing typed is lost. The coach asks questions per section; in draft mode the answers
 * become a paragraph, otherwise they stay beside the editor as notes.
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
  return (
    <section className="mt-3" aria-labelledby="guided-title">
      <h3 id="guided-title" className="text-base font-medium text-slate-900">
        {t.title}
      </h3>
      <p className="mt-1 text-sm text-slate-600">{t.intro}</p>
      {!draftMode && <p className="mt-1 text-sm text-slate-600">{t.coachModeNote}</p>}
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

              {s.questions.length > 0 && (
                <div className="mt-3 grid gap-3">
                  <HelpText id={hintId}>{t.answerHint}</HelpText>
                  {s.questions.map((q, i) => {
                    const id = `guided-${s.id}-${i}`;
                    return (
                      <DictatedAnswer
                        key={id}
                        id={id}
                        question={q}
                        name={`answer:${s.id}`}
                        defaultValue={s.answers[i] ?? ""}
                        describedBy={hintId}
                      />
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
    </section>
  );
}
