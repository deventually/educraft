import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";

/** Where a team sits: its programmes and division (`teamPlaces`), or null. */
type Place = { programmes: string[]; division: string | null } | null | undefined;

/** "Opleiding VPK voltijd · Faculteit Gezondheid", or "" for a team that sits nowhere. */
function placeText(t: ReturnType<typeof useT>, place: Place): string {
  if (!place) return "";
  const parts: string[] = [];
  const n = place.programmes.length;
  if (n > 0)
    parts.push(
      fmt(n === 1 ? t.teams.placeProgramme : t.teams.placeProgrammes, {
        names: place.programmes.join(", "),
      }),
    );
  if (place.division) parts.push(place.division);
  return parts.join(" · ");
}

/** One row per team: member, and lead (only for a member), and where the team sits. Saves itself. */
export function TeamsForm({
  teams,
  errorMessage,
}: {
  teams: { id: string; name: string; member: boolean; lead: boolean; place?: Place }[];
  errorMessage: (code: string | true) => string | undefined;
}) {
  const t = useT();
  const box =
    "size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500";
  return (
    <AutoSaveForm intent="teams" errorMessage={errorMessage}>
      <ul className="space-y-2.5">
        {teams.map((team) => (
          <li key={team.id} className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
            <span className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id={`team-member-${team.id}`}
                name="teams"
                value={team.id}
                defaultChecked={team.member}
                className={box}
              />
              <label
                htmlFor={`team-member-${team.id}`}
                className="text-sm font-medium text-slate-800"
              >
                {fmt(t.teams.memberOf, { name: team.name })}
              </label>
            </span>
            <span className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id={`team-lead-${team.id}`}
                name="leads"
                value={team.id}
                defaultChecked={team.lead}
                className={box}
              />
              <label htmlFor={`team-lead-${team.id}`} className="text-sm text-slate-700">
                {fmt(t.teams.leadOf, { name: team.name })}
              </label>
            </span>
            {placeText(t, team.place) && (
              <span className="basis-full text-xs text-slate-500">{placeText(t, team.place)}</span>
            )}
          </li>
        ))}
      </ul>
    </AutoSaveForm>
  );
}
