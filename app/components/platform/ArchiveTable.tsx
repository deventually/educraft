import { Form } from "react-router";
import { Button } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import type { ArchivedRow } from "./types";

const th = "px-4 py-2.5 font-semibold";
const td = "px-4 py-2.5 text-slate-600";

function day(iso: string, locale: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "nl-NL", {
    dateStyle: "long",
    timeZone,
  });
}

/** Removed institutions: when they went, the day they are erased, and a way back until then. */
export function ArchiveTable({
  archived,
  timeZone,
}: {
  archived: ArchivedRow[];
  timeZone: string;
}) {
  const t = useT().platform;
  const locale = useLocale();
  if (archived.length === 0) return <p className="text-sm text-slate-500">{t.archiveEmpty}</p>;

  return (
    <div className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{t.archiveHeading}</caption>
        <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className={th}>
              {t.colName}
            </th>
            <th scope="col" className={th}>
              {t.colHosts}
            </th>
            <th scope="col" className={th}>
              {t.colRemovedAt}
            </th>
            <th scope="col" className={th}>
              {t.colPurgeAt}
            </th>
            <th scope="col" className={th}>
              {t.colActions}
            </th>
          </tr>
        </thead>
        <tbody>
          {archived.map((row) => (
            <tr key={row.key} className="border-b border-slate-50 last:border-0">
              <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-900">
                {row.name} <code className="text-xs font-normal text-slate-500">({row.id})</code>
              </th>
              <td className={td}>
                <span className="break-all">{row.hosts.join(", ")}</span>
              </td>
              <td className={td}>{day(row.removedAt, locale, timeZone)}</td>
              <td className={td}>{day(row.purgeAt, locale, timeZone)}</td>
              <td className={td}>
                <Form method="post">
                  <input type="hidden" name="intent" value="restore" />
                  <input type="hidden" name="key" value={row.key} />
                  <Button type="submit" size="sm" variant="secondary">
                    {t.restore}
                  </Button>
                </Form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
