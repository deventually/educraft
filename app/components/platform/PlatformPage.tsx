import { useActionData } from "react-router";
import { useFormToast } from "~/components/Toast";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { AddInstitutionForm } from "./AddInstitutionForm";
import { ArchiveTable } from "./ArchiveTable";
import { InstitutionTable } from "./InstitutionTable";
import type { ArchivedRow, InstitutionRow, PlatformResult } from "./types";

const h2 = "font-display text-lg font-medium tracking-tight text-slate-900";

const done = {
  activate: "doneActivated",
  add: "doneAdded",
  deactivate: "doneDeactivated",
  remove: "doneRemoved",
  restore: "doneRestored",
} as const;

/**
 * The platform page (`/platform`) for the platform owner: the institutions with their status,
 * adding one, (de)activating, removing into the archive and restoring from it. Every action's
 * result is a toast; only the password link of a new institution stays on the page.
 */
export function PlatformPage({
  institutions,
  archived,
  timeZone,
}: {
  institutions: InstitutionRow[];
  archived: ArchivedRow[];
  timeZone: string;
}) {
  const t = useT().platform;
  // The route's action returns a `PlatformResult` (app/routes/platform.tsx).
  const result = useActionData() as PlatformResult | undefined;

  useFormToast(result, {
    result: (d) => {
      if (!d) return null;
      if (!d.ok) return { variant: "error", message: t.errors[d.error] };
      const key = done[d.intent as keyof typeof done];
      return key ? { variant: "success", message: fmt(t[key], { name: d.name ?? "" }) } : null;
    },
  });

  const added =
    result?.ok && result.intent === "add" && result.setPasswordLink
      ? {
          name: result.name ?? "",
          adminName: result.adminName ?? "",
          setPasswordLink: result.setPasswordLink,
        }
      : null;

  return (
    <div className="space-y-8">
      <section aria-labelledby="platform-heading" className="space-y-4">
        <div>
          <h2 id="platform-heading" className={h2}>
            {t.heading}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{t.intro}</p>
        </div>
        <AddInstitutionForm added={added} />
        <InstitutionTable institutions={institutions} />
      </section>

      <section aria-labelledby="platform-archive-heading" className="space-y-3">
        <div>
          <h2 id="platform-archive-heading" className={h2}>
            {t.archiveHeading}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{t.archiveIntro}</p>
        </div>
        <ArchiveTable archived={archived} timeZone={timeZone} />
      </section>
    </div>
  );
}
