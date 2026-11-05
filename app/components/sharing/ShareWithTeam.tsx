import { useId } from "react";
import { Form } from "react-router";
import { Share2 } from "lucide-react";
import { Badge, Button, Card } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

export interface ShareWithTeamProps {
  teams: { id: string; name: string }[];
  sharedWith: string[];
  /** Extra hidden fields, e.g. the item id on a page that lists several items. */
  fields?: Record<string, string>;
  /** Folded away under a summary line, for a page with several items. */
  collapsible?: boolean;
}

/**
 * "Delen met je team" (P28.4): per team of the owner, share or stop sharing. Without a
 * team there is nothing to share with, so nothing is shown.
 */
export function ShareWithTeam({
  teams,
  sharedWith,
  fields = {},
  collapsible = false,
}: ShareWithTeamProps) {
  const t = useT();
  const s = t.sharing;
  const id = useId();
  if (teams.length === 0) return null;
  const shared = new Set(sharedWith);

  const rows = (
    <ul className="divide-y divide-slate-100">
      {teams.map((team) => {
        const on = shared.has(team.id);
        return (
          <li key={team.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span className="flex items-center gap-2 font-medium text-slate-900">
              {team.name}
              {on && <Badge>{s.shared}</Badge>}
            </span>
            <Form method="post">
              {Object.entries(fields).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <input type="hidden" name="intent" value={on ? "unshare" : "share"} />
              <input type="hidden" name="teamId" value={team.id} />
              <Button
                type="submit"
                size="sm"
                variant={on ? "ghost" : "secondary"}
                aria-label={fmt(on ? s.stopLabel : s.shareLabel, { team: team.name })}
              >
                {on ? s.stop : s.share}
              </Button>
            </Form>
          </li>
        );
      })}
    </ul>
  );

  if (collapsible) {
    return (
      <details className="rounded-xl border border-slate-200">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium text-slate-800">
          <Share2 className="size-4 text-violet-600" aria-hidden />
          {s.heading}
          {shared.size > 0 && <Badge>{s.shared}</Badge>}
        </summary>
        <p className="px-4 text-sm text-slate-600">{s.intro}</p>
        {rows}
      </details>
    );
  }

  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="flex items-center gap-2 text-lg font-medium text-slate-900">
        <Share2 className="size-4 text-violet-600" aria-hidden />
        {s.heading}
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{s.intro}</p>
      <Card className="mt-3">{rows}</Card>
    </section>
  );
}
