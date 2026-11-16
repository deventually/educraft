import { useT } from "~/lib/i18n/useT";
import { MAX_NAME } from "~/lib/people/pasteList";
import { ROLES } from "~/lib/registry/access";
import { Input, Select } from "~/components/ui";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { LastActive, StatusBadge, roleLabel } from "~/components/admin/people";

const h2 = "font-display text-lg font-medium tracking-tight text-slate-900";
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

/**
 * The Account section of a person's page (P28.1): name, e-mail and role, each an autosaving
 * field where the viewer may change it and plain text where not, then status, two-step
 * verification and last active. Authority is decided by the page and again on the server.
 */
export function PersonAccount({
  person,
  editName,
  editEmail,
  editRole,
  errorMessage,
}: {
  person: {
    name: string;
    email: string | null;
    role: string;
    status: "active" | "disabled";
    lastActiveDay: string | null;
    twoFactor: boolean;
  };
  editName: boolean;
  editEmail: boolean;
  editRole: boolean;
  errorMessage: (code: string | true) => string | undefined;
}) {
  const t = useT();
  const p = t.people;
  const i = t.admin.invites;
  return (
    <section>
      <h2 className={h2}>{p.account}</h2>
      <dl className={`mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr] ${card}`}>
        <dt className="font-medium text-slate-600">
          {editName ? <label htmlFor="person-name">{p.nameLabel}</label> : p.nameLabel}
        </dt>
        <dd className="text-slate-800">
          {editName ? (
            <AutoSaveForm intent="setName" errorMessage={errorMessage}>
              <Input
                id="person-name"
                name="name"
                type="text"
                required
                maxLength={MAX_NAME}
                autoComplete="off"
                defaultValue={person.name}
                className="h-9 max-w-xs text-sm"
              />
            </AutoSaveForm>
          ) : (
            person.name || "—"
          )}
        </dd>
        <dt className="font-medium text-slate-600">
          {editEmail ? <label htmlFor="person-email">{p.emailLabel}</label> : p.emailLabel}
        </dt>
        <dd className="text-slate-800">
          {editEmail ? (
            <AutoSaveForm intent="setEmail" errorMessage={errorMessage}>
              <Input
                id="person-email"
                name="email"
                type="email"
                defaultValue={person.email ?? ""}
                placeholder={i.emailPlaceholder}
                className="h-9 max-w-xs text-sm"
              />
            </AutoSaveForm>
          ) : (
            (person.email ?? "—")
          )}
        </dd>
        <dt className="font-medium text-slate-600">
          {editRole ? <label htmlFor="person-role">{p.roleLabel}</label> : p.roleLabel}
        </dt>
        <dd className="text-slate-800">
          {editRole ? (
            <AutoSaveForm intent="role" errorMessage={errorMessage}>
              <Select id="person-role" name="role" defaultValue={person.role} className="w-auto">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(t, r)}
                  </option>
                ))}
              </Select>
            </AutoSaveForm>
          ) : (
            roleLabel(t, person.role)
          )}
        </dd>
        <dt className="font-medium text-slate-600">{p.status}</dt>
        <dd>
          <StatusBadge status={person.status} />
        </dd>
        <dt className="font-medium text-slate-600">{t.twoFactor.adminLabel}</dt>
        <dd className="text-slate-800">
          {person.twoFactor ? t.twoFactor.statusOn : t.twoFactor.statusOff}
        </dd>
        <dt className="font-medium text-slate-600">{p.lastActive}</dt>
        <dd className="text-slate-800">
          <LastActive day={person.lastActiveDay} />
        </dd>
      </dl>
    </section>
  );
}
