import { useEffect, useRef, useState } from "react";
import { Form, useActionData } from "react-router";
import { Trash2 } from "lucide-react";
import type { Route } from "./+types/admin.announcements";
import { requireRole } from "~/server/auth.server";
import {
  createAnnouncement,
  listAnnouncements,
  removeAnnouncement,
} from "~/server/repositories/announcements.server";
import { listTeams } from "~/server/repositories/teams.server";
import { listPeople } from "~/server/repositories/users.server";
import {
  ANNOUNCEMENT_MAX,
  REMIND_MAX_DAYS,
  type AnnouncementFormError,
  parseAnnouncementForm,
} from "~/lib/announcements";
import { DEFAULT_TIME_ZONE, todayIn } from "~/lib/calendar/weeks";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { useFormToast } from "~/components/Toast";
import { Button, HelpText, Input, Label, Select, Textarea } from "~/components/ui";

/** The most people the person picker offers (the people list's own cap). */
const MAX_PEOPLE = 500;

/** A long text cut for a button's accessible name. */
const short = (text: string) => (text.length > 60 ? `${text.slice(0, 60)}…` : text);

const today = () => todayIn(DEFAULT_TIME_ZONE, new Date());

/**
 * Announcements (admin): post a banner for everyone, one team or one person, with an
 * optional last day and an optional number of days after which a closed banner comes back;
 * the list below shows what was posted and removes it. The banner itself is
 * `components/shell/AnnouncementBanner.tsx`, fed by the root loader.
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const day = today();
  const [rows, teams, people] = await Promise.all([
    listAnnouncements(),
    listTeams(),
    listPeople({ status: "active", limit: MAX_PEOPLE }),
  ]);
  return {
    today: day,
    announcements: rows.map((a) => ({ ...a, active: a.endsOn === null || a.endsOn >= day })),
    teams: teams.map((team) => ({ id: team.id, name: team.name })),
    people: people
      .filter((p) => p.kind === "user")
      .map((p) => ({ id: p.id, name: p.name ?? p.email ?? p.id, email: p.email }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

type ActionResult =
  | { created: true }
  | { removed: true }
  | { error: AnnouncementFormError | "notFound" };

export async function action({ request }: Route.ActionArgs): Promise<ActionResult> {
  const admin = await requireRole(request, "admin");
  const fd = await request.formData();
  const intent = fd.get("intent");

  if (intent === "create") {
    const parsed = parseAnnouncementForm(fd, today());
    if (!parsed.ok) return { error: parsed.error };
    const made = await createAnnouncement({ ...parsed.value, createdBy: admin.id });
    if (made) return { created: true };
    return { error: parsed.value.audience.kind === "team" ? "teamRequired" : "userRequired" };
  }

  if (intent === "remove") {
    const id = String(fd.get("id") ?? "");
    return (await removeAnnouncement(id)) ? { removed: true } : { error: "notFound" };
  }

  return { error: "invalid" };
}

const h2 = "font-display text-lg font-medium tracking-tight text-slate-900";
const th = "px-4 py-2.5 font-semibold";
const td = "px-4 py-2.5 text-slate-600";
const radio = "flex items-center gap-2 text-sm text-slate-800";
const fieldset = "space-y-2";
const legend = "mb-1 text-sm font-medium text-slate-800";

export default function AdminAnnouncements({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const a = t.announcements.admin;
  const data = useActionData<typeof action>();
  const formRef = useRef<HTMLFormElement>(null);
  const [audience, setAudience] = useState<"all" | "team" | "user">("all");
  const { announcements, teams, people } = loaderData;

  useFormToast(data, {
    result: (d) => {
      if (!d) return null;
      if ("created" in d) return { variant: "success", message: a.created };
      if ("removed" in d) return { variant: "success", message: a.removed };
      return { variant: "error", message: a.error[d.error] };
    },
  });

  // A posted announcement empties the form for the next one.
  useEffect(() => {
    if (data && "created" in data) {
      formRef.current?.reset();
      setAudience("all");
    }
  }, [data]);

  return (
    <div className="space-y-10">
      <section aria-labelledby="announcements-new">
        <h2 id="announcements-new" className={h2}>
          {a.heading}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{a.intro}</p>

        <Form
          ref={formRef}
          method="post"
          className="mt-4 max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <input type="hidden" name="intent" value="create" />
          <div>
            <Label htmlFor="announcement-message" required>
              {a.messageLabel}
            </Label>
            <Textarea
              id="announcement-message"
              name="message"
              required
              rows={3}
              maxLength={ANNOUNCEMENT_MAX}
              aria-describedby="announcement-message-hint"
              className="mt-1"
            />
            <HelpText id="announcement-message-hint">
              {fmt(a.messageHint, { max: ANNOUNCEMENT_MAX })}
            </HelpText>
          </div>

          <fieldset className={fieldset}>
            <legend className={legend}>{a.levelLegend}</legend>
            <label className={radio}>
              <input type="radio" name="level" value="info" defaultChecked />
              {a.levelInfo}
            </label>
            <label className={radio}>
              <input type="radio" name="level" value="warning" />
              {a.levelWarning}
            </label>
          </fieldset>

          <fieldset className={fieldset}>
            <legend className={legend}>{a.audienceLegend}</legend>
            {(
              [
                ["all", a.audienceAll],
                ["team", a.audienceTeam],
                ["user", a.audienceUser],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className={radio}>
                <input
                  type="radio"
                  name="audience"
                  value={value}
                  checked={audience === value}
                  onChange={() => setAudience(value)}
                />
                {label}
              </label>
            ))}
            {audience === "team" && (
              <div className="pl-6">
                <Label htmlFor="announcement-team">{a.team}</Label>
                <Select id="announcement-team" name="teamId" required className="mt-1 sm:max-w-sm">
                  <option value="">{a.pickTeam}</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {audience === "user" && (
              <div className="pl-6">
                <Label htmlFor="announcement-user">{a.user}</Label>
                <Select id="announcement-user" name="userId" required className="mt-1 sm:max-w-sm">
                  <option value="">{a.pickUser}</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.email && p.email !== p.name ? `${p.name} (${p.email})` : p.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="announcement-ends">{a.endsLabel}</Label>
              <Input
                id="announcement-ends"
                name="endsOn"
                type="date"
                min={loaderData.today}
                aria-describedby="announcement-ends-hint"
                className="mt-1"
              />
              <HelpText id="announcement-ends-hint">{a.endsHint}</HelpText>
            </div>
            <div>
              <Label htmlFor="announcement-remind">{a.remindLabel}</Label>
              <Input
                id="announcement-remind"
                name="remindAfterDays"
                type="number"
                inputMode="numeric"
                min={1}
                max={REMIND_MAX_DAYS}
                step={1}
                aria-describedby="announcement-remind-hint"
                className="mt-1"
              />
              <HelpText id="announcement-remind-hint">{a.remindHint}</HelpText>
            </div>
          </div>

          <Button type="submit">{a.submit}</Button>
        </Form>
      </section>

      <section aria-labelledby="announcements-list">
        <h2 id="announcements-list" className={h2}>
          {a.listHeading}
        </h2>
        {announcements.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{a.empty}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{a.caption}</caption>
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className={th}>
                    {a.colMessage}
                  </th>
                  <th scope="col" className={th}>
                    {a.colAudience}
                  </th>
                  <th scope="col" className={th}>
                    {a.colEnds}
                  </th>
                  <th scope="col" className={th}>
                    {a.colReturns}
                  </th>
                  <th scope="col" className={th}>
                    {a.colStatus}
                  </th>
                  <th scope="col" className={th}>
                    <span className="sr-only">{a.remove}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {announcements.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 align-top last:border-0">
                    <th
                      scope="row"
                      className="max-w-sm whitespace-pre-line px-4 py-2.5 text-left font-normal text-slate-800"
                    >
                      <span className="font-semibold">
                        {row.level === "warning" ? a.levelWarning : a.levelInfo}:
                      </span>{" "}
                      {row.message}
                    </th>
                    <td className={td}>
                      {row.audience.kind === "all"
                        ? a.audienceAll
                        : row.audience.kind === "team"
                          ? fmt(a.audienceTeamOf, { name: row.audience.name })
                          : row.audience.name}
                    </td>
                    <td className={td}>{row.endsOn ?? a.noEnd}</td>
                    <td className={td}>
                      {row.remindAfterDays
                        ? fmt(a.returnsEvery, { days: row.remindAfterDays })
                        : a.returnsNever}
                    </td>
                    <td className={td}>{row.active ? a.statusActive : a.statusEnded}</td>
                    <td className="px-4 py-2">
                      <Form method="post">
                        <input type="hidden" name="intent" value="remove" />
                        <input type="hidden" name="id" value={row.id} />
                        <Button
                          type="submit"
                          variant="secondary"
                          aria-label={fmt(a.removeLabel, { message: short(row.message) })}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          {a.remove}
                        </Button>
                      </Form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
