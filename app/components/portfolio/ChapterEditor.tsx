import { useState } from "react";
import { Form } from "react-router";
import { wordCount } from "~/lib/portfolio/progress";
import { LIMITS } from "~/lib/portfolio/schema";
import { Button, Label, Textarea } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

/** The chapter for one outcome, with a live word count. */
export function ChapterEditor({
  outcomeId,
  defaultValue,
  maxWords,
}: {
  outcomeId: string;
  defaultValue: string;
  maxWords?: number;
}) {
  const t = useT().portfolio.outcome;
  const [text, setText] = useState(defaultValue);
  const n = wordCount(text);
  const countId = `chapter-count-${outcomeId}`;
  return (
    <Form method="post" className="grid gap-2">
      <input type="hidden" name="intent" value="writeChapter" />
      <input type="hidden" name="outcomeId" value={outcomeId} />
      <Label htmlFor={`chapter-${outcomeId}`}>{t.chapterLabel}</Label>
      <Textarea
        id={`chapter-${outcomeId}`}
        name="text"
        rows={16}
        value={text}
        maxLength={LIMITS.documentText}
        aria-describedby={countId}
        onChange={(e) => setText(e.target.value)}
      />
      <p id={countId} className="text-sm text-slate-600">
        {maxWords ? fmt(t.chapterWordsLimit, { n, limit: maxWords }) : fmt(t.chapterWords, { n })}
      </p>
      <div>
        <Button type="submit">{t.saveChapter}</Button>
      </div>
    </Form>
  );
}
