import { Form, redirect, useActionData } from "react-router";
import { UserPlus } from "lucide-react";
import type { Route } from "./+types/teams.$id";
import { requireUser } from "~/server/auth.server";
import {
  getTeamForLead,
  leadAddMember,
  leadCreateInvite,
  leadMakeLead,
  leadRemoveMember,
  leadStepDown,
} from "~/server/repositories/teams.server";
import { useT } from "~/lib/i18n/useT";
import { useFormToast } from "~/components/Toast";
import { Button, Input, Label } from "~/components/ui";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { LinkCard } from "~/components/admin/LinkCard";
import { teamError } from "~/components/teams/teamError";

/** Days a lead's invite link stays valid (the admin's default). */
const INVITE_DAYS = 14;

/**
 * The team lead's page (P28.2, teacher side): the members (name, e-mail), add a colleague
 * by exact e-mail, remove a plain member, make a member lead, step down, and an invite
 * link that makes a new teacher a member. Anyone who is not lead of this team, an admin
 * included, gets a 404: the admin works on /admin/teams.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const team = await getTeamForLead(user.id, params.id);
  if (!team) throw new Response("Not found", { status: 404 });
  return { selfId: user.id, team };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  // notLead → 404, before anything is read from the form.
  if (!(await getTeamForLead(user.id, params.id))) {
    throw new Response("Not found", { status: 404 });
  }
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  const userId = String(fd.get("userId") ?? "");
  const done = (r: { ok: true } | { error: string }) =>
    "ok" in r ? { saved: true as const } : { error: r.error };

  if (intent === "addMember") {
    return done(await leadAddMember(user.id, params.id, String(fd.get("email") ?? "")));
  }
  if (intent === "removeMember") return done(await leadRemoveMember(user.id, params.id, userId));
  if (intent === "makeLead") return done(await leadMakeLead(user.id, params.id, userId));
  if (intent === "stepDown") {
    await leadStepDown(user.id, params.id);
    // This page is no longer yours: back to the account page with your teams.
    return redirect("/account");
  }
  if (intent === "invite") {
    const note = String(fd.get("note") ?? "").trim() || null;
    const res = await leadCreateInvite(user.id, params.id, {
      note,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
    });
    if (!("token" in res)) throw new Response("Not found", { status: 404 });
    return { link: `${new URL(request.url).origin}/invite/${res.token}` };
  }
  return { error: "unknown" };
}

const h2 = "font-display text-lg font-medium tracking-tight text-slate-900";
const card = "mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const th = "px-4 py-2.5 font-semibold";

export default function LeadTeam({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const tt = t.teams;
  const { team, selfId } = loaderData;
  const actionData = useActionData<typeof action>();

  useFormToast(actionData, {
    result: (d) =>
      !d
        ? null
        : "error" in d && typeof d.error === "string"
          ? { variant: "error", message: teamError(t, d.error) }
          : { variant: "success", message: t.admin.console.saved },
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <header>
        <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
          {team.name}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{tt.leadIntro}</p>
      </header>

      <section>
        <h2 className={h2}>{tt.members}</h2>
        <div className="relative mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{tt.members}</caption>
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className={th}>
                  {tt.colName}
                </th>
                <th scope="col" className={th}>
                  {tt.colEmail}
                </th>
                <th scope="col" className={th}>
                  <span className="sr-only">{t.people.colActions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {team.members.map((m) => (
                <tr key={m.userId} className="border-b border-slate-50 last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-800">
                    {m.name}
                    {m.userId === selfId && (
                      <span className="ml-1.5 text-xs font-normal text-slate-500">
                        ({t.admin.invites.you})
                      </span>
                    )}
                    {m.isLead && (
                      <span className="ml-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
                        {tt.leadBadge}
                      </span>
                    )}
                  </th>
                  <td className="px-4 py-2.5 text-slate-600">{m.email ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {!m.isLead && (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Form method="post">
                          <input type="hidden" name="intent" value="makeLead" />
                          <input type="hidden" name="userId" value={m.userId} />
                          <Button type="submit" variant="secondary" size="sm">
                            {tt.makeLead}
                          </Button>
                        </Form>
                        <Form method="post">
                          <input type="hidden" name="intent" value="removeMember" />
                          <input type="hidden" name="userId" value={m.userId} />
                          <Button type="submit" variant="secondary" size="sm">
                            {tt.remove}
                          </Button>
                        </Form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className={h2}>{tt.addHeading}</h2>
        <p id="team-add-hint" className="mt-1 text-sm text-slate-600">
          {tt.addHint}
        </p>
        <Form method="post" className="mt-3 flex max-w-xl flex-wrap items-end gap-3">
          <input type="hidden" name="intent" value="addMember" />
          <div className="min-w-48 flex-1">
            <Label htmlFor="team-add-email">{tt.addEmailLabel}</Label>
            <Input
              id="team-add-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              aria-describedby="team-add-hint"
              className="mt-1"
            />
          </div>
          <Button type="submit">
            <UserPlus className="size-4" aria-hidden />
            {tt.add}
          </Button>
        </Form>
      </section>

      <section>
        <h2 className={h2}>{tt.inviteHeading}</h2>
        <p className="mt-1 text-sm text-slate-600">{tt.inviteIntro}</p>
        {actionData && "link" in actionData ? (
          <LinkCard
            heading={t.admin.invites.linkHeading}
            hint={t.admin.invites.linkHint}
            url={actionData.link}
            copyLabel={t.admin.invites.copy}
          />
        ) : (
          <Form method="post" className={`${card} max-w-xl space-y-3`}>
            <input type="hidden" name="intent" value="invite" />
            <div>
              <Label htmlFor="team-invite-note">{t.admin.invites.noteLabel}</Label>
              <Input
                id="team-invite-note"
                name="note"
                type="text"
                placeholder={t.admin.invites.notePlaceholder}
                className="mt-1"
              />
            </div>
            <Button type="submit" variant="secondary">
              {tt.inviteSubmit}
            </Button>
          </Form>
        )}
      </section>

      <section>
        <ConfirmDialog
          triggerLabel={tt.stepDown}
          triggerVariant="secondary"
          title={tt.stepDownTitle}
          description={tt.stepDownBody}
          confirmLabel={tt.stepDown}
          cancelLabel={t.confirm.cancel}
          fields={{ intent: "stepDown" }}
        />
      </section>
    </div>
  );
}
