import { useEffect, useState } from "react";
import { useActionData, useNavigation } from "react-router";
import { Trash2, Plus, Pencil, ArrowLeft, Layers } from "lucide-react";
import type { Route } from "./+types/context-profiles";
import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  getDefaultProfile,
} from "~/server/repositories/profiles.server";
import { requireUser } from "~/server/auth.server";
import { listItemShares, copySharedItem } from "~/server/repositories/shares.server";
import { listTeamsForUser } from "~/server/repositories/teams.server";
import { listProgrammes } from "~/server/repositories/programmes.server";
import { shareAction, sharedWithMe } from "~/server/sharing.server";
import { ShareWithTeam } from "~/components/sharing/ShareWithTeam";
import { SharedWithMe } from "~/components/sharing/SharedWithMe";
import {
  getAvailableSectors,
  getAvailableDomains,
  getAvailableDomainSlugs,
} from "~/server/availability.server";
import type { ContextProfile } from "~/lib/context/types";
import { parseContextForm } from "~/lib/context/parseForm";
import { resolveLevel } from "~/lib/context/derive";
import { getDomainsForTrack } from "~/lib/context/domains";
import { Button, Card, Badge } from "~/components/ui";
import { EmptyState } from "~/components/EmptyState";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useFormToast } from "~/components/Toast";
import { ContextProfileEditor } from "~/components/context/ContextProfileEditor";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { HelpLink } from "~/components/HelpLink";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const [profiles, def, availableSectors, availableDomains] = await Promise.all([
    listProfiles(user.id),
    getDefaultProfile(user.id),
    getAvailableSectors(user),
    // The instance's flat domain allow-list (null = unrestricted). The editor
    // filters each track catalogue by it client-side.
    getAvailableDomainSlugs(user),
  ]);
  // Sharing (P28.4): the owner's teams, per own profile the teams it is shared with, and
  // "Van mijn team".
  const [teams, shared, sharedWith, ownProgrammes] = await Promise.all([
    listTeamsForUser(user.id),
    sharedWithMe(user, "contextProfile"),
    Promise.all(profiles.map((p) => listItemShares(user.id, "contextProfile", p.id))),
    // The programmes of the teacher's own teams, offered as a choice for "Opleiding".
    listProgrammes({ id: user.id, role: "teacher" }, 500),
  ]);
  return {
    profiles,
    defaultId: def?.id ?? "",
    availableSectors,
    availableDomains,
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
    sharedWith: Object.fromEntries(profiles.map((p, i) => [p.id, sharedWith[i]])),
    shared,
    programmes: [...new Set(ownProgrammes.map((p) => p.name))].sort((a, b) => a.localeCompare(b)),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  // "Delen met team" (P28.4): the repository only shares the caller's own profile.
  const shareId = String((await request.clone().formData()).get("id") ?? "");
  const shared = await shareAction(request, user, "contextProfile", shareId);
  if (shared) return shared;
  const fd = await request.formData();
  const intent = fd.get("intent");

  if (intent === "copy-shared") {
    const copyId = await copySharedItem(user.id, "contextProfile", String(fd.get("id") ?? ""));
    if (copyId) return { ok: true, intent: "copy-shared" as const };
    return { ok: false, error: getMessages(getLocale(request)).sharing.errorNotFound };
  }

  if (intent === "delete") {
    await deleteProfile(user.id, String(fd.get("id")));
    return { ok: true };
  }

  if (intent === "create" || intent === "update") {
    // Re-validate the submitted sector against what THIS user may use — never
    // trust the client (mirrors the tool loader-404 / stream-refuse seam).
    const availableSectors = await getAvailableSectors(user);
    const { input, isDefault, error } = parseContextForm(fd, { availableSectors });
    if (error || !input) {
      const m = getMessages(getLocale(request));
      return {
        ok: false,
        error: error === "name-required" ? m.settings.nameRequired : m.settings.optionUnavailable,
      };
    }
    // Re-validate the submitted domain against the teacher's available set —
    // never trust the body (mirrors the sector re-check above).
    if (input.domain) {
      const availableDomains = await getAvailableDomains(user, input.sector, input.track);
      if (!availableDomains.includes(input.domain)) {
        const m = getMessages(getLocale(request));
        return { ok: false, error: m.settings.optionUnavailable };
      }
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
    ? (getDomainsForTrack(profile.country, profile.sector, profile.track).find(
        (d) => d.value === profile.domain,
      )?.label ?? profile.domain)
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
  const {
    profiles,
    defaultId,
    availableSectors,
    availableDomains,
    teams = [],
    sharedWith = {},
    shared = [],
    programmes = [],
  } = loaderData;
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  // null = list view; { profile? } = the editor (create when profile is undefined).
  const [editor, setEditor] = useState<{ profile?: ContextProfile } | null>(null);

  // After any successful submit, collapse back to the list.
  useEffect(() => {
    if (actionData?.ok) setEditor(null);
  }, [actionData]);

  useFormToast(actionData, {
    result: (d) => {
      if (!d) return null;
      if (d.ok && "message" in d) return { variant: "success", message: d.message };
      if (d.ok && "intent" in d && d.intent === "copy-shared")
        return { variant: "success", message: t.sharing.toastCopied };
      if (d.ok) return { variant: "success", message: t.admin.console.saved };
      const err = "error" in d ? d.error : undefined;
      return err ? { variant: "error", message: err } : null;
    },
  });

  const editing = editor?.profile;

  return (
    <div className="w-full min-w-0">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.settings.heading}
      </h1>
      <p className="mt-2 text-slate-600">{t.settings.intro}</p>
      <HelpLink topic="context-profiles" />

      {profiles.length === 0 && !editor && (
        <EmptyState
          icon={<Layers aria-hidden />}
          title={t.settings.emptyTitle}
          body={t.settings.emptyBody}
          action={{ onClick: () => setEditor({}), label: t.settings.emptyAction }}
        />
      )}

      <section className="mt-6 space-y-3">
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
                <div className="mt-3">
                  <ShareWithTeam
                    teams={teams}
                    sharedWith={sharedWith[p.id] ?? []}
                    fields={{ id: p.id }}
                    collapsible
                  />
                </div>
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

      <SharedWithMe items={shared} />

      {(profiles.length > 0 || editor) && (
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
              availableSectors={availableSectors}
              availableDomains={availableDomains}
              programmeOptions={programmes}
              onCancel={() => setEditor(null)}
            />
          ) : (
            <Button type="button" onClick={() => setEditor({})}>
              <Plus className="size-4" aria-hidden /> {t.settings.newProfile}
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
