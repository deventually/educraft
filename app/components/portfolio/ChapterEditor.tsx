import { type ReactNode, useState } from "react";
import { Form } from "react-router";
import { wordCount } from "~/lib/portfolio/progress";
import { markersIn } from "~/lib/portfolio/openSpots";
import { LIMITS } from "~/lib/portfolio/schema";
import { Button, Label, Textarea } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { AiCallField } from "~/components/AiLeaveGuard";

/**
 * The chapter for one outcome, with a live word count. `children` sit in the
 * same form above the text (guided writing): their buttons post the current
 * text too, so unsaved edits are kept and a paragraph is appended to them.
 */
export function ChapterEditor({
  outcomeId,
  defaultValue,
  maxWords,
  children,
}: {
  outcomeId: string;
  defaultValue: string;
  maxWords?: number;
  children?: ReactNode;
}) {
  const t = useT().portfolio;
  const [text, setText] = useState(defaultValue);
  const n = wordCount(text);
  const open = markersIn(text).length;
  const countId = `chapter-count-${outcomeId}`;
  const openId = `chapter-open-${outcomeId}`;
  return (
    <Form method="post" className="grid gap-2">
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
      <div>
        <Button type="submit" name="intent" value="writeChapter">
          {t.outcome.saveChapter}
        </Button>
      </div>
    </Form>
  );
}
