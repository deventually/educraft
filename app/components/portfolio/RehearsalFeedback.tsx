import { Link, useFetcher } from "react-router";
import { useActionToast } from "~/components/Toast";
import { Button } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import { outcomeLabel } from "~/lib/portfolio/format";
import { HEARD_LABELS, type RehearsalFeedback as Feedback } from "~/lib/portfolio/rehearsal";
import type { Framework } from "~/lib/portfolio/types";

interface Props {
  dossierId: string;
  framework: Framework;
  feedback: Feedback;
  /** What the server re-checks when the teacher keeps it: the model's answer and their turns. */
  raw: string;
  userTurns: string[];
  outcomeIds: string[];
  model: string;
}

type KeepResult = { ok: true; intent: string } | { ok: false; error: string };

/**
 * The rehearsal feedback (brief P29, 29.3): a table per criterion with what the
 * committee heard, the teacher's own words, a tip and a way to the chapter, and
 * "Bewaar in je dossier". Nothing is kept until the teacher presses it.
 */
export function RehearsalFeedback(props: Props) {
  const { dossierId, framework, feedback } = props;
  const t = useT().portfolioRehearsal;
  const locale = useLocale();
  const fetcher = useFetcher<KeepResult>();
  const kept = fetcher.data?.ok === true;
  useActionToast(fetcher.data, (data) =>
    data.ok ? { variant: "success", message: t.kept } : { variant: "error", message: data.error },
  );

  const criteria = new Map(
    framework.outcomes.flatMap((o) => o.criteria.map((c) => [c.id, { o, c }] as const)),
  );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <caption className="mb-2 text-left font-semibold text-slate-900">{t.caption}</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-600">
              <th scope="col" className="py-2 pr-3 font-medium">
                {t.columns.criterion}
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                {t.columns.heard}
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                {t.columns.quote}
              </th>
              <th scope="col" className="py-2 font-medium">
                {t.columns.tip}
              </th>
            </tr>
          </thead>
          <tbody>
            {feedback.criteria.map((f) => {
              const found = criteria.get(f.criterionId);
              if (!found) return null;
              return (
                <tr key={f.criterionId} className="border-b border-slate-100 align-top">
                  <th scope="row" className="py-2 pr-3 font-normal text-slate-800">
                    <span className="block text-xs text-slate-500">{outcomeLabel(found.o)}</span>
                    {found.c.text}
                    <Link
                      to={`/portfolio/${dossierId}/outcome/${found.o.id}`}
                      className="mt-1 block font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      {t.updateChapter}
                    </Link>
                  </th>
                  <td className="py-2 pr-3 font-medium text-slate-900">
                    {HEARD_LABELS[locale][f.heard]}
                  </td>
                  <td className="py-2 pr-3 italic text-slate-700">
                    {f.quote ? `"${f.quote}"` : t.noQuote}
                  </td>
                  <td className="py-2 text-slate-700">{f.tip ?? t.noQuote}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {feedback.overall && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{t.summary}</h3>
          <p className="mt-1 text-sm text-slate-700">{feedback.overall}</p>
        </div>
      )}
      <p className="text-xs text-slate-600">{t.notAJudgement}</p>
      {kept ? (
        <Link
          to={`/portfolio/${dossierId}`}
          className="inline-block font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          {t.keptLink}
        </Link>
      ) : (
        <fetcher.Form method="post" action={`/portfolio/${dossierId}/rehearsal`}>
          <input type="hidden" name="intent" value="keepRehearsal" />
          <input type="hidden" name="raw" value={props.raw} />
          <input type="hidden" name="userTurns" value={JSON.stringify(props.userTurns)} />
          <input type="hidden" name="outcomeIds" value={JSON.stringify(props.outcomeIds)} />
          <input type="hidden" name="model" value={props.model} />
          <Button type="submit" disabled={fetcher.state !== "idle"}>
            {t.keep}
          </Button>
        </fetcher.Form>
      )}
    </div>
  );
}
