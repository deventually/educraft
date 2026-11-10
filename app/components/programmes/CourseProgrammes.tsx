import { useId } from "react";
import { Form, Link } from "react-router";
import { Button, Card, Label, Select } from "~/components/ui";
import { PlacementFields, usePlacementText } from "./PlacementFields";
import { useT } from "~/lib/i18n/useT";

export interface CourseProgrammesData {
  placed: {
    programmeId: string;
    name: string;
    teamName: string;
    year: number | null;
    period: number | null;
  }[];
  options: { id: string; name: string; teamName: string }[];
}

/**
 * "Hoort bij opleiding" on the course page: the programmes this course sits in, each with
 * its year and period, and a form to put it in one (or move it within one).
 */
export function CourseProgrammes({ placed, options }: CourseProgrammesData) {
  const p = useT().programmes;
  const o = p.onCourse;
  const id = useId();
  const placementText = usePlacementText();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {o.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{o.intro}</p>
      {placed.length === 0 ? (
        <p className="mt-3 text-slate-600">{o.empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {placed.map((pl) => (
            <li
              key={pl.programmeId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm"
            >
              <span>
                <Link
                  to={`/programmes/${pl.programmeId}`}
                  className="font-medium text-slate-900 underline-offset-2 hover:underline"
                >
                  {pl.name}
                </Link>
                <span className="ml-2 text-sm text-slate-600">
                  {p.team} {pl.teamName} · {placementText(pl)}
                </span>
              </span>
              <Form method="post">
                <input type="hidden" name="intent" value="programme-remove" />
                <input type="hidden" name="programmeId" value={pl.programmeId} />
                <Button type="submit" size="sm" variant="ghost">
                  {p.remove}
                  <span className="sr-only"> ({pl.name})</span>
                </Button>
              </Form>
            </li>
          ))}
        </ul>
      )}
      {options.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          {o.noProgrammes}{" "}
          <Link
            to="/programmes"
            className="font-medium text-violet-700 underline underline-offset-2"
          >
            {o.noProgrammesLink}
          </Link>
        </p>
      ) : (
        <Card className="mt-3 p-4">
          <Form method="post" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="intent" value="programme-place" />
            <div className="w-full sm:w-auto sm:min-w-48 sm:flex-1">
              <Label htmlFor={`${id}-programme`}>{o.programme}</Label>
              <Select id={`${id}-programme`} name="programmeId" className="mt-1">
                {options.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({p.team.toLowerCase()} {x.teamName})
                  </option>
                ))}
              </Select>
            </div>
            <PlacementFields id={id} />
            <Button type="submit" size="sm">
              {p.save}
            </Button>
          </Form>
          <p className="mt-2 text-xs text-slate-500">{p.yearPeriodHint}</p>
          <p className="mt-1 text-xs text-slate-500">{o.sharesWith}</p>
        </Card>
      )}
    </section>
  );
}
