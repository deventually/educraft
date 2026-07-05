import { useState } from "react";
import { Form, Link, useActionData } from "react-router";
import { Copy } from "lucide-react";
import type { Route } from "./+types/admin.invites";
import { requireRole } from "~/server/auth.server";
import { getAvailableTools } from "~/server/availability.server";
import {
  createInvite,
  listInvitesWithContext,
  listUsers,
  revokeInvite,
  setUserRole,
} from "~/server/repositories/users.server";
import type { Role } from "~/lib/registry/access";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import { Button, HelpText, Input, Label, Select } from "~/components/ui";

const ROLES: Role[] = ["student", "teacher", "admin"];

export async function loader({ request }: Route.LoaderArgs) {
  const admin = await requireRole(request, "admin");
  // Candidate tools an admin can grant a teacher = whatever a teacher may see.
  const teacherTools = await getAvailableTools({ id: "__invite_preview__", role: "teacher" });
  const [invites, users] = await Promise.all([listInvitesWithContext(), listUsers()]);
  return {
    selfId: admin.id,
    tools: teacherTools.map((t) => ({ slug: t.slug, name: t.name })),
    invites: invites.map((i) => ({
      token: i.token,
      role: i.role,
      note: i.note,
      email: i.email,
      expiresAt: i.expiresAt,
      used: Boolean(i.usedByUserId),
      createdByName: i.createdByName,
      cohortName: i.cohortName,
      createdAt: i.createdAt,
    })),
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const admin = await requireRole(request, "admin");
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");

  if (intent === "mint") {
    const note = String(fd.get("note") ?? "").trim() || null;
    const expiryDays = Math.min(90, Math.max(1, Number(fd.get("expiryDays") ?? "14") || 14));
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    // Only registry-known tools a teacher may see can be granted (never trust the body).
    const teacherTools = await getAvailableTools({ id: "__invite_preview__", role: "teacher" });
    const grantable = new Set(teacherTools.map((t) => t.slug));
    const restrict = String(fd.get("toolMode") ?? "all") === "restrict";
    const selected = fd
      .getAll("tools")
      .map(String)
      .filter((s) => grantable.has(s));
    const invite = await createInvite({
      role: "teacher", // admins are never minted by invite
      note,
      expiresAt,
      createdByUserId: admin.id,
      allowedToolSlugs: restrict ? selected : null,
    });
    return { link: `${new URL(request.url).origin}/invite/${invite.token}` };
  }

  if (intent === "revoke") {
    await revokeInvite(String(fd.get("token") ?? ""));
    return { revoked: true as const };
  }

  if (intent === "role") {
    const userId = String(fd.get("userId") ?? "");
    const role = String(fd.get("role") ?? "");
    // An admin can never change their OWN role — no self-lockout.
    if (userId === admin.id) return { error: "selfDemote" as const };
    if ((ROLES as string[]).includes(role)) await setUserRole(userId, role as Role);
    return { roleChanged: true as const };
  }

  return { error: "unknown" as const };
}

export default function AdminInvites({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  const { selfId, tools, invites, users } = loaderData;
  const [restrict, setRestrict] = useState(false);

  const roleLabel: Record<string, string> = {
    student: t.admin.invites.roleStudent,
    teacher: t.admin.invites.roleTeacher,
    admin: t.admin.invites.roleAdmin,
  };

  return (
    <div className="space-y-10">
      {/* ── Mint a teacher invite ─────────────────────────────────────────── */}
      <section>
        <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
          {t.admin.invites.mintHeading}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t.admin.invites.mintIntro}</p>

        {actionData && "error" in actionData && actionData.error === "selfDemote" && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {t.admin.invites.selfDemoteError}
          </p>
        )}

        {actionData && "link" in actionData && actionData.link ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">{t.admin.invites.linkHeading}</h3>
            <p className="mt-1 text-sm text-slate-600">{t.admin.invites.linkHint}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">
                {actionData.link}
              </span>
              <CopyButton url={actionData.link} label={t.admin.invites.copy} />
            </div>
          </div>
        ) : (
          <Form method="post" className="mt-4 max-w-xl space-y-4">
            <input type="hidden" name="intent" value="mint" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="note">{t.admin.invites.noteLabel}</Label>
                <Input
                  id="note"
                  name="note"
                  type="text"
                  placeholder={t.admin.invites.notePlaceholder}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="expiryDays">{t.admin.invites.expiryLabel}</Label>
                <Input
                  id="expiryDays"
                  name="expiryDays"
                  type="number"
                  min={1}
                  max={90}
                  defaultValue={14}
                  className="mt-1"
                />
              </div>
            </div>

            <fieldset className="space-y-2.5">
              <legend className="text-sm font-semibold text-slate-800">
                {t.admin.invites.toolsLegend}
              </legend>
              <HelpText>{t.admin.invites.toolsHint}</HelpText>
              <label className="flex items-center gap-2.5 text-sm text-slate-800">
                <input
                  type="radio"
                  name="toolMode"
                  value="all"
                  defaultChecked
                  onChange={() => setRestrict(false)}
                  className="size-4 border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                />
                {t.admin.invites.allToolsOption}
              </label>
              <label className="flex items-center gap-2.5 text-sm text-slate-800">
                <input
                  type="radio"
                  name="toolMode"
                  value="restrict"
                  onChange={() => setRestrict(true)}
                  className="size-4 border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                />
                {t.admin.invites.restrictOption}
              </label>
              {restrict && (
                <ul className="mt-1 grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                  {tools.map((tool) => (
                    <li key={tool.slug} className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        id={`grant-${tool.slug}`}
                        name="tools"
                        value={tool.slug}
                        className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                      />
                      <label
                        htmlFor={`grant-${tool.slug}`}
                        className="text-sm font-medium text-slate-800"
                      >
                        {loc(tool.name, locale)}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            <Button type="submit">{t.admin.invites.submit}</Button>
            <p className="text-xs text-slate-500">
              <Link to="/cohorts" className="font-medium text-violet-600 hover:underline">
                {t.admin.invites.cohortLink}
              </Link>
            </p>
          </Form>
        )}
      </section>

      {/* ── All invites (oversight) ───────────────────────────────────────── */}
      <section>
        <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
          {t.admin.invites.listHeading}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t.admin.invites.listIntro}</p>
        {invites.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{t.admin.invites.none}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t.admin.invites.listHeading}</caption>
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t.admin.invites.colRole}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t.admin.invites.colRecipient}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t.admin.invites.colStatus}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t.admin.invites.colCreator}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    {t.admin.invites.colCohort}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                    <span className="sr-only">{t.admin.invites.revoke}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const expired =
                    !inv.used &&
                    inv.expiresAt != null &&
                    new Date(inv.expiresAt).getTime() < Date.now();
                  const status = inv.used
                    ? t.admin.invites.statusUsed
                    : expired
                      ? t.admin.invites.statusExpired
                      : t.admin.invites.statusOpen;
                  const open = !inv.used && !expired;
                  return (
                    <tr key={inv.token} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2.5 text-slate-700">
                        {roleLabel[inv.role] ?? inv.role}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {inv.email ?? inv.note ?? t.admin.invites.linkOnly}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{status}</td>
                      <td className="px-4 py-2.5 text-slate-600">{inv.createdByName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-slate-600">{inv.cohortName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        {open && (
                          <Form method="post">
                            <input type="hidden" name="intent" value="revoke" />
                            <input type="hidden" name="token" value={inv.token} />
                            <Button type="submit" variant="danger" size="sm">
                              {t.admin.invites.revoke}
                            </Button>
                          </Form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Users & roles ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
          {t.admin.invites.usersHeading}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t.admin.invites.usersIntro}</p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t.admin.invites.usersHeading}</caption>
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.invites.colName}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.invites.colEmail}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.invites.colUserRole}
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  <span className="sr-only">{t.admin.invites.changeRole}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === selfId;
                return (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-800">
                      {u.name}
                      {isSelf && (
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          ({t.admin.invites.you})
                        </span>
                      )}
                    </th>
                    <td className="px-4 py-2.5 text-slate-600">{u.email ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{roleLabel[u.role] ?? u.role}</td>
                    <td className="px-4 py-2.5">
                      {isSelf ? (
                        <span className="block text-right text-xs text-slate-400">—</span>
                      ) : (
                        <Form method="post" className="flex items-center justify-end gap-2">
                          <input type="hidden" name="intent" value="role" />
                          <input type="hidden" name="userId" value={u.id} />
                          <label htmlFor={`role-${u.id}`} className="sr-only">
                            {t.admin.invites.changeRole} — {u.name}
                          </label>
                          <Select
                            id={`role-${u.id}`}
                            name="role"
                            defaultValue={u.role}
                            className="w-auto"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {roleLabel[r]}
                              </option>
                            ))}
                          </Select>
                          <Button type="submit" variant="secondary" size="sm">
                            {t.admin.invites.apply}
                          </Button>
                        </Form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CopyButton({ url, label }: { url: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(url).then(
          () => setDone(true),
          () => setDone(false),
        );
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      <Copy className="size-3.5" aria-hidden />
      {done ? "✓" : label}
    </button>
  );
}
