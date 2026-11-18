import { useId, useState } from "react";
import { Form } from "react-router";
import { Button, Card, HelpText, Input, Label, Select } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { outcomeLabel } from "~/lib/portfolio/format";
import { QUOTE_LIMITS } from "~/lib/portfolio/schema";
import {
  FEEDBACK_ROLES,
  type FeedbackQuote,
  type FeedbackRole,
  type FeedbackSource,
} from "~/lib/portfolio/types";
import type { SendRoundState } from "~/lib/hooks/useSendRound";

export interface QuotesOutcome {
  id: string;
  code: string;
  title: string;
  criteria: { id: string; text: string }[];
}

export interface QuotesItem {
  id: string;
  title: string;
  text: string;
  feedback?: FeedbackSource;
}

/** The last proposal for this item, from the page's action. */
export interface QuotesProposal {
  quotes: FeedbackQuote[];
  dropped: number;
}

const same = (a: FeedbackQuote, b: FeedbackQuote) =>
  a.criterionId === b.criterionId && a.text === b.text;

/**
 * One piece of feedback: who gave it, "Stel citaten voor" (through the overview before sending),
 * and per criterion the proposed and chosen quotes to tick. Nothing is stored without Bewaar.
 */
export function FeedbackQuotes({
  item,
  outcomes,
  proposal,
  round,
}: {
  item: QuotesItem;
  outcomes: QuotesOutcome[];
  proposal?: QuotesProposal;
  round: SendRoundState;
}) {
  const t = useT().portfolioQuotes;
  const uid = useId();
  const [giver, setGiver] = useState(item.feedback?.giver ?? "");
  const [role, setRole] = useState<FeedbackRole>(item.feedback?.role ?? "workplace-supervisor");
  const [date, setDate] = useState(item.feedback?.date ?? "");
  const chosen = item.feedback?.quotes ?? [];
  // The chosen quotes first, then the proposals that are new; the chosen ones stay ticked.
  const shown = [
    ...chosen,
    ...(proposal?.quotes ?? []).filter((q) => !chosen.some((c) => same(c, q))),
  ];
  const [ticked, setTicked] = useState<FeedbackQuote[]>(chosen);
  const isTicked = (q: FeedbackQuote) => ticked.some((x) => same(x, q));
  const toggle = (q: FeedbackQuote, on: boolean) =>
    setTicked((prev) => (on ? [...prev, q] : prev.filter((x) => !same(x, q))));

  function propose() {
    const form = new FormData();
    form.set("intent", "proposeQuotes");
    form.set("evidenceId", item.id);
    form.set("role", role);
    // The giver's name is replaced too, also where it stands in the feedback itself.
    if (giver.trim()) round.privacy.alsoReplace(giver);
    round.start(form, [
      { name: `feedback:${item.id}`, label: item.title, text: item.text, held: true },
    ]);
  }

  const groups = outcomes.flatMap((o) =>
    o.criteria.flatMap((c, i) => {
      const quotes = shown.filter((q) => q.criterionId === c.id);
      return quotes.length ? [{ o, c, n: i + 1, quotes }] : [];
    }),
  );
  const heading = `${uid}-h`;

  return (
    <Card className="p-4">
      <section aria-labelledby={heading}>
        <h2 id={heading} className="text-lg font-medium text-slate-900">
          {item.title}
        </h2>
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-violet-700">{t.showFeedback}</summary>
          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            {item.text}
          </p>
        </details>
        <Form method="post" className="mt-4 grid gap-4">
          <input type="hidden" name="intent" value="chooseQuotes" />
          <input type="hidden" name="evidenceId" value={item.id} />
          <input type="hidden" name="quotes" value={JSON.stringify(ticked)} />
          <fieldset className="grid gap-3 sm:grid-cols-3">
            <legend className="mb-1 text-sm font-medium text-slate-700">{t.giverLegend}</legend>
            <div>
              <Label htmlFor={`${uid}-giver`}>{t.giver}</Label>
              <Input
                id={`${uid}-giver`}
                name="giver"
                required
                autoComplete="off"
                maxLength={QUOTE_LIMITS.giver}
                value={giver}
                aria-describedby={`${uid}-giver-help`}
                onChange={(e) => setGiver(e.target.value)}
              />
              <HelpText id={`${uid}-giver-help`}>{t.giverHelp}</HelpText>
            </div>
            <div>
              <Label htmlFor={`${uid}-role`}>{t.role}</Label>
              <Select
                id={`${uid}-role`}
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value as FeedbackRole)}
              >
                {FEEDBACK_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t.roles[r]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`${uid}-date`}>{t.date}</Label>
              <Input
                id={`${uid}-date`}
                name="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </fieldset>

          {proposal && proposal.quotes.length === 0 && (
            <p className="text-sm text-slate-700">{t.noneFound}</p>
          )}
          {proposal && proposal.dropped > 0 && (
            <p className="text-sm text-slate-600">
              {proposal.dropped === 1 ? t.droppedOne : fmt(t.dropped, { n: proposal.dropped })}
            </p>
          )}

          {groups.length > 0 ? (
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">{t.quotesLegend}</legend>
              <div className="mt-2 grid gap-3">
                {groups.map(({ o, c, n, quotes }) => (
                  <fieldset key={c.id} className="rounded-xl border border-slate-200 p-3">
                    <legend className="px-1 text-sm text-slate-700">
                      <span className="font-medium">
                        {fmt(t.criterion, { outcome: outcomeLabel(o), n })}
                      </span>{" "}
                      {c.text}
                    </legend>
                    <ul className="mt-1 space-y-2">
                      {quotes.map((q) => (
                        <li key={q.text}>
                          <label className="flex items-start gap-2 text-sm text-slate-800">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={isTicked(q)}
                              onChange={(e) => toggle(q, e.target.checked)}
                            />
                            <span>“{q.text}”</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </fieldset>
                ))}
              </div>
            </fieldset>
          ) : (
            !proposal && <p className="text-sm text-slate-600">{t.chosenNone}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={propose}>
              {chosen.length || proposal ? t.proposeAgain : t.propose}
            </Button>
            <Button type="submit">{t.save}</Button>
          </div>
        </Form>
      </section>
    </Card>
  );
}
