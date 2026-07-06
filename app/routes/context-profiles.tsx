import { useEffect, useState } from "react";
import { useActionData, useNavigation } from "react-router";
import { Trash2, Plus, Pencil, ArrowLeft } from "lucide-react";
import type { Route } from "./+types/context-profiles";
import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  getDefaultProfile,
} from "~/server/repositories/profiles.server";
import { requireUser } from "~/server/auth.server";
import { getAvailableCountries, getAvailableSectors } from "~/server/availability.server";
import type { ContextProfile } from "~/lib/context/types";
import { parseContextForm } from "~/lib/context/parseForm";
import { resolveLevel } from "~/lib/context/derive";
import { getDomainsForSector } from "~/lib/context/domains";
import { Button, Card, Badge } from "~/components/ui";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { ContextProfileEditor } from "~/components/context/ContextProfileEditor";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const [profiles, def, availableCountries, availableSectors] = await Promise.all([
    listProfiles(user.id),
    getDefaultProfile(user.id),
    getAvailableCountries(user),
    getAvailableSectors(user),
  ]);
  return {
    profiles,
    defaultId: def?.id ?? "",
    availableCountries,
    availableSectors,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const fd = await request.formData();
  const intent = fd.get("intent");

  if (intent === "delete") {
    await deleteProfile(user.id, String(fd.get("id")));
    return { ok: true };
  }

  if (intent === "create" || intent === "update") {
    // Re-validate the submitted country/sector against what THIS user may use —
    // never trust the client (mirrors the tool loader-404 / stream-refuse seam).
    const [availableCountries, availableSectors] = await Promise.all([
      getAvailableCountries(user),
      getAvailableSectors(user),
    ]);
    const { input, isDefault, error } = parseContextForm(fd, {
      availableCountries,
      availableSectors,
    });
    if (error || !input) {
      const m = getMessages(getLocale(request));
      return {
        ok: false,
        error: error === "name-required" ? m.settings.nameRequired : m.settings.optionUnavailable,
      };
    }
    if (intent === "update") {
      const id = String(fd.get("id") ?? "");
      if (id) await updateProfile(user.id, id, input, isDefault);
    } else {
      await createProfile(user.id, input, isDefault);
    }
    return { ok: true };
  }

  return { ok: false };
}

/** A short, readable summary line for a profile card. */
function ProfileMeta({ profile, locale }: { profile: ContextProfile; locale: "nl" | "en" }) {
  const domainLabel = profile.domain
    ? (getDomainsForSector(profile.country, profile.sector).find((d) => d.value === profile.domain)
        ?.label ?? profile.domain)
    : undefined;
  const parts = [
    profile.programme,
    profile.courseName,
    domainLabel ? loc(domainLabel, locale) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return parts ? <p className="mt-1 text-sm text-slate-600">{parts}</p> : null;
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { profiles, defaultId, availableCountries, availableSectors } = loaderData;
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  // null = list view; { profile? } = the editor (create when profile is undefined).
  const [editor, setEditor] = useState<{ profile?: ContextProfile } | null>(null);

  // After any successful submit, collapse back to the list.
  useEffect(() => {
    if (actionData?.ok) setEditor(null);
  }, [actionData]);

  const editing = editor?.profile;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.settings.heading}
      </h1>
      <p className="mt-2 text-slate-600">{t.settings.intro}</p>

      <section className="mt-6 space-y-3">
        {profiles.length === 0 && <p className="text-sm text-slate-500">{t.settings.empty}</p>}
        {profiles.map((p) => {
          const level = resolveLevel(p);
          return (
            <Card
              key={p.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{p.name}</p>
                  {p.sector && <Badge>{p.sector.toUpperCase()}</Badge>}
                  {level && <Badge>EQF {level.eqf}</Badge>}
                  {p.id === defaultId && <Badge>{t.settings.defaultBadge}</Badge>}
                </div>
                <ProfileMeta profile={p} locale={locale} />
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => setEditor({ profile: p })}
                >
                  <Pencil className="size-4" aria-hidden /> {t.settings.edit}
                </Button>
                <ConfirmDialog
                  triggerLabel={t.settings.delete}
                  triggerIcon={<Trash2 className="size-4" aria-hidden />}
                  title={t.settings.deleteTitle}
                  description={t.settings.deleteBody}
                  confirmLabel={t.settings.delete}
                  cancelLabel={t.confirm.cancel}
                  fields={{ intent: "delete", id: p.id }}
                />
              </div>
            </Card>
          );
        })}
      </section>

      <Card className="mt-8 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            {editing ? (
              <>
                <Pencil className="size-4 text-violet-600" aria-hidden /> {t.settings.editProfile}
              </>
            ) : (
              <>
                <Plus className="size-4 text-violet-600" aria-hidden /> {t.settings.newProfile}
              </>
            )}
          </h2>
          {editor && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditor(null)}>
              <ArrowLeft className="size-4" aria-hidden /> {t.settings.cancel}
            </Button>
          )}
        </div>

        {actionData && !actionData.ok && actionData.error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionData.error}
          </p>
        )}

        {editor ? (
          <ContextProfileEditor
            key={editing?.id ?? "new"}
            profile={editing}
            isCurrentDefault={editing != null && editing.id === defaultId}
            availableCountries={availableCountries}
            availableSectors={availableSectors}
            onCancel={() => setEditor(null)}
          />
        ) : (
          <Button type="button" onClick={() => setEditor({})}>
            <Plus className="size-4" aria-hidden /> {t.settings.newProfile}
          </Button>
        )}
      </Card>
    </div>
  );
}
