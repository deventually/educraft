import type { Messages } from "~/lib/i18n";
import { useLocale, useT } from "~/lib/i18n/useT";
import { cn } from "~/lib/utils";

/** Where a person stands (P28.1); mirrors `PersonStatus` in the users repository. */
export type PersonStatus = "active" | "invited" | "disabled";

/** The localized name of a role; a retired role (e.g. "student") shows as stored. */
export function roleLabel(t: Messages, role: string): string {
  if (role === "teacher") return t.admin.invites.roleTeacher;
  if (role === "admin") return t.admin.invites.roleAdmin;
  return role;
}

const STATUS_STYLE: Record<PersonStatus, string> = {
  active: "bg-emerald-50 text-emerald-800",
  invited: "bg-sky-50 text-sky-800",
  disabled: "bg-amber-100 text-amber-900",
};

/** A person's status as a small pill: Active, Invited or Deactivated. */
export function StatusBadge({ status }: { status: PersonStatus }) {
  const t = useT();
  const label = {
    active: t.people.statusActive,
    invited: t.people.statusInvited,
    disabled: t.people.statusDisabled,
  }[status];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[status])}>
      {label}
    </span>
  );
}

/** The last day of use ("YYYY-MM-DD", UTC) as a date, or "not yet". */
export function LastActive({ day }: { day: string | null }) {
  const t = useT();
  const locale = useLocale();
  if (!day) return <>{t.people.never}</>;
  const date = new Date(`${day}T00:00:00Z`);
  const text = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "nl-NL", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
  return <time dateTime={day}>{text}</time>;
}

/** The super-admin badge (P18.6). */
export function OwnerBadge() {
  const t = useT();
  return (
    <span className="ml-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
      {t.admin.invites.ownerBadge}
    </span>
  );
}
