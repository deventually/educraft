import { AlertTriangle } from "lucide-react";
import type { AdminHealth } from "~/lib/health";
import type { Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";

const MB = 1024 ** 2;
const GB = 1024 ** 3;

/** `12,3 MB` / `2,5 GB`: megabytes below a gigabyte, gigabytes above, in the reader's locale. */
export function formatBytes(bytes: number, locale: Locale): string {
  const [value, unit] = bytes >= GB ? [bytes / GB, "GB"] : [bytes / MB, "MB"];
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  return `${n} ${unit}`;
}

/**
 * The admin's health overview (P1): the age of the newest backup, the database size and the free
 * disk space, with a warning when the backup is older than 36 hours or missing. Rendered once per
 * page load, so the warning is plain text, not a live region.
 */
export function HealthPanel({ health }: { health: AdminHealth }) {
  const t = useT();
  const locale = useLocale();
  const h = t.admin.health;
  const { backup } = health;

  const backupText =
    backup.state === "off"
      ? h.backupOff
      : backup.state === "none"
        ? h.backupNone
        : backup.ageHours < 1
          ? h.justNow
          : backup.ageHours < 48
            ? fmt(h.hoursAgo, { n: backup.ageHours })
            : fmt(h.daysAgo, { n: Math.floor(backup.ageHours / 24) });
  const warn = backup.state === "stale" || backup.state === "none";
  const bytes = (n: number | null) => (n === null ? h.unknown : formatBytes(n, locale));

  const items = [
    {
      label: h.backup,
      value: "at" in backup ? <time dateTime={backup.at}>{backupText}</time> : backupText,
    },
    { label: h.database, value: bytes(health.databaseBytes) },
    { label: h.freeDisk, value: bytes(health.freeDiskBytes) },
  ];

  return (
    <section
      aria-labelledby="admin-health-heading"
      className="mb-6 rounded-xl border border-slate-200 bg-white p-4"
    >
      <h2 id="admin-health-heading" className="text-sm font-semibold text-slate-900">
        {h.heading}
      </h2>
      <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {items.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-slate-600">{label}</dt>
            <dd className="font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      {warn && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {h.staleWarning}
        </p>
      )}
    </section>
  );
}
