import { useId } from "react";
import { Form, Link } from "react-router";
import { CopyPlus, Users } from "lucide-react";
import { Button, Card } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

export interface SharedItem {
  id: string;
  name: string;
  ownerName: string;
  teamNames: string[];
}

/**
 * "Van mijn team" (P28.4): what colleagues share with the viewer's teams. Read only, with
 * "Maak een kopie", which posts `intent=copy-shared` and the item `id` to the list page.
 */
export function SharedWithMe({
  items,
  viewHref,
}: {
  items: SharedItem[];
  viewHref?: (id: string) => string;
}) {
  const t = useT();
  const s = t.sharing;
  const id = useId();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="flex items-center gap-2 text-lg font-medium text-slate-900">
        <Users className="size-4 text-violet-600" aria-hidden />
        {s.fromTeam}
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{s.fromTeamIntro}</p>
      <Card className="mt-3">
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div className="min-w-0">
                {viewHref ? (
                  <Link
                    to={viewHref(item.id)}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <p className="font-medium text-slate-900">{item.name}</p>
                )}
                <p className="text-sm text-slate-600">
                  {fmt(s.owner, { owner: item.ownerName, teams: item.teamNames.join(", ") })}
                </p>
              </div>
              <Form method="post">
                <input type="hidden" name="intent" value="copy-shared" />
                <input type="hidden" name="id" value={item.id} />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  aria-label={fmt(s.copyLabel, { name: item.name })}
                >
                  <CopyPlus className="size-4" aria-hidden />
                  {s.copy}
                </Button>
              </Form>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
