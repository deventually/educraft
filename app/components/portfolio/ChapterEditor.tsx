import { useState } from "react";
import { Form } from "react-router";
import { wordCount } from "~/lib/portfolio/progress";
import { LIMITS } from "~/lib/portfolio/schema";
import { Button, HelpText, Label, Textarea } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

export interface DraftTarget {
  criterionId: string;
  /** 1-based position of the criterion in the outcome. */
  n: number;
  hasEvidence: boolean;
}

/**
 * The chapter for one outcome, with a live word count. In draft mode each
 * criterion gets a "draft a paragraph" button; it posts the current text too,
 * so unsaved edits are kept and the paragraph is appended to them.
 */
export function ChapterEditor({
  outcomeId,
  defaultValue,
  maxWords,
  drafts,
}: {
  outcomeId: string;
  defaultValue: string;
  maxWords?: number;
  /** Present only in draft mode with a confirmed framework. */
  drafts?: DraftTarget[];
}) {
  const t = useT().portfolio;
  const [text, setText] = useState(defaultValue);
  const n = wordCount(text);
  const countId = `chapter-count-${outcomeId}`;
  return (
    <Form method="post" className="grid gap-2">
      <input type="hidden" name="outcomeId" value={outcomeId} />
      <Label htmlFor={`chapter-${outcomeId}`}>{t.outcome.chapterLabel}</Label>
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
        {maxWords
          ? fmt(t.outcome.chapterWordsLimit, { n, limit: maxWords })
          : fmt(t.outcome.chapterWords, { n })}
      </p>
      <div>
        <Button type="submit" name="intent" value="writeChapter">
          {t.outcome.saveChapter}
        </Button>
      </div>
      {drafts && drafts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {drafts.map((d) =>
            d.hasEvidence ? (
              <Button
                key={d.criterionId}
                type="submit"
                name="intent"
                value={`draft:${d.criterionId}`}
                variant="secondary"
                size="sm"
              >
                {fmt(t.draft.button, { n: d.n })}
              </Button>
            ) : (
              <HelpText key={d.criterionId}>{fmt(t.draft.needsEvidence, { n: d.n })}</HelpText>
            ),
          )}
        </div>
      )}
    </Form>
  );
}
