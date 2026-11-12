import { useId } from "react";
import { Form } from "react-router";
import { Button, Card, Input, Label } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmtDate } from "~/lib/portfolio/format";

/**
 * Visits (brief P38.6): the track keeps only the dates. The preparation and the report are made
 * with the milestone's tools and leave through Word or the clipboard; the toast announces a save.
 */
export function VisitsPanel({ visits }: { visits: readonly string[] }) {
  const m = useT().tracks.visits;
  const locale = useLocale();
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-base font-medium text-slate-900">
        {m.heading}
      </h3>
      <Card className="mt-2 p-4">
        <p className="max-w-[65ch] text-sm text-slate-600">{m.intro}</p>
        {visits.length === 0 ? (
          <p className="mt-3 text-sm text-slate-700">{m.none}</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-slate-800">
            {visits.map((d) => (
              <li key={d}>{fmt(m.on, { date: fmtDate(d, locale) })}</li>
            ))}
          </ul>
        )}
        <Form method="post" className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="intent" value="visit" />
          <div>
            <Label htmlFor={`${id}-date`}>{m.date}</Label>
            <Input id={`${id}-date`} name="date" type="date" required className="mt-1" />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            {m.add}
          </Button>
        </Form>
      </Card>
    </section>
  );
}
