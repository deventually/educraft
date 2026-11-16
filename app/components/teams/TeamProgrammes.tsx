import { Form, Link } from "react-router";
import { Unlink } from "lucide-react";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { Button, HelpText, Label, Select } from "~/components/ui";

const link =
  "rounded font-medium text-violet-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

/**
 * The programmes of a team (admin team page, BESLUIT-2026-11-16-1): its own, each to unlink, a
 * way to start a new one for it, and linking it to a programme of other teams. A programme can
 * have several teams (the programme team, module teams) and always keeps at least one.
 */
export function TeamProgrammes({
  teamId,
  programmes,
  others,
}: {
  teamId: string;
  programmes: { id: string; name: string }[];
  others: { id: string; name: string; teamName: string }[];
}) {
  const tt = useT().teams;
  return (
    <section
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-labelledby="team-programmes"
    >
      <h3 id="team-programmes" className="text-sm font-semibold text-slate-800">
        {tt.programmesHeading}
      </h3>
      {programmes.length === 0 ? (
        <p className="text-sm text-slate-500">{tt.programmesNone}</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {programmes.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-1.5">
              <Link to={`/programmes/${p.id}`} className={link}>
                {p.name}
              </Link>
              <Form method="post">
                <input type="hidden" name="intent" value="unlinkProgramme" />
                <input type="hidden" name="programmeId" value={p.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  aria-label={fmt(tt.programmesUnlink, { name: p.name })}
                  title={fmt(tt.programmesUnlink, { name: p.name })}
                >
                  <Unlink className="size-3.5" aria-hidden />
                </Button>
              </Form>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm">
        <Link to={`/programmes?team=${encodeURIComponent(teamId)}`} className={link}>
          {tt.programmesNew}
        </Link>
      </p>
      {others.length > 0 && (
        <Form method="post" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="intent" value="linkProgramme" />
          <div className="min-w-48 flex-1 sm:max-w-sm">
            <Label htmlFor="team-link-programme">{tt.programmesLink}</Label>
            <Select
              id="team-link-programme"
              name="programmeId"
              aria-describedby="team-link-programme-hint"
              className="mt-1"
            >
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.teamName})
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            {tt.programmesLinkButton}
          </Button>
          <HelpText id="team-link-programme-hint">{tt.programmesLinkHint}</HelpText>
        </Form>
      )}
    </section>
  );
}
