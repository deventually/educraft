import { type ReactNode, useEffect, useRef, useState } from "react";
import { Form } from "react-router";
import { wordCount } from "~/lib/portfolio/progress";
import { fillMarker, markersIn } from "~/lib/portfolio/openSpots";
import { LIMITS } from "~/lib/portfolio/schema";
import { Button, Label, Textarea } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { AiCallField } from "~/components/AiLeaveGuard";
import { AiPatternCheck } from "./AiPatternCheck";
import { OpenSpotFill } from "./OpenSpotFill";

/**
 * Where focus goes when the chapter mounts after a post (WCAG 2.4.3): the route remounts the
 * form, so the pressed button is a new element. Questions the coach just asked: their first
 * empty answer; otherwise the button that was pressed, or the chapter text when it is gone.
 */
function focusTarget(form: HTMLFormElement, intent: string): HTMLElement | null {
  const asked = /^guide(?:Questions|FollowUp):(.+)$/.exec(intent);
  const answers = asked
    ? `textarea[name="answer:${CSS.escape(asked[1] ?? "")}"]`
    : intent === "guideGrill" || intent === "guideQuestionsAll"
      ? 'textarea[name^="answer:"]'
      : null;
  if (answers) {
    const open = [...form.querySelectorAll<HTMLTextAreaElement>(answers)].find(
      (a) => !a.value.trim(),
    );
    if (open) return open;
  }
  return (
    form.querySelector<HTMLElement>(`button[name="intent"][value="${CSS.escape(intent)}"]`) ??
    form.querySelector<HTMLElement>('textarea[name="text"]')
  );
}

/**
 * The chapter for one outcome, with a live word count. `children` sit in the
 * same form above the text (guided writing): their buttons post the current
 * text too, so unsaved edits are kept and a paragraph is appended to them.
 */
export function ChapterEditor({
  outcomeId,
  defaultValue,
  maxWords,
  focusAfter,
  children,
}: {
  outcomeId: string;
  defaultValue: string;
  maxWords?: number;
  /** The intent of the post that just remounted this form, if any. */
  focusAfter?: string;
  children?: ReactNode;
}) {
  const t = useT().portfolio;
  const [text, setText] = useState(defaultValue);
  const form = useRef<HTMLFormElement>(null);
  // Only on mount: without a remount the pressed button keeps its focus.
  const mountedAfter = useRef(focusAfter);
  useEffect(() => {
    const intent = mountedAfter.current;
    if (intent && form.current) focusTarget(form.current, intent)?.focus();
  }, []);
  const n = wordCount(text);
  const open = markersIn(text).length;
  const countId = `chapter-count-${outcomeId}`;
  const openId = `chapter-open-${outcomeId}`;
  return (
    <Form ref={form} method="post" className="grid gap-2">
      {/* The guided-writing buttons ask the AI: leaving mid-call asks first. */}
      <AiCallField />
      <input type="hidden" name="outcomeId" value={outcomeId} />
      {children}
      <Label htmlFor={`chapter-${outcomeId}`}>{t.outcome.chapterLabel}</Label>
      <Textarea
        id={`chapter-${outcomeId}`}
        name="text"
        rows={16}
        value={text}
        maxLength={LIMITS.documentText}
        aria-describedby={open > 0 ? `${countId} ${openId}` : countId}
        onChange={(e) => setText(e.target.value)}
      />
      <p id={countId} className="text-sm text-slate-600">
        {maxWords
          ? fmt(t.outcome.chapterWordsLimit, { n, limit: maxWords })
          : fmt(t.outcome.chapterWords, { n })}
      </p>
      {/* Open spots never reach the handed-in work (BESLUIT-2026-11-07-4). */}
      {open > 0 && (
        <p id={openId} className="text-sm font-medium text-amber-800">
          {open === 1 ? t.outcome.openSpotsOne : fmt(t.outcome.openSpots, { n: open })}
        </p>
      )}
      <OpenSpotFill
        text={text}
        onFill={(i, answer) => setText((t) => fillMarker(t, i, answer))}
        doneFocusId={`chapter-${outcomeId}`}
      />
      <AiPatternCheck text={text} />
      <div>
        <Button type="submit" name="intent" value="writeChapter">
          {t.outcome.saveChapter}
        </Button>
      </div>
    </Form>
  );
}
