import { useState } from "react";
import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import { ArrowLeft, Copy, LineChart } from "lucide-react";
import type { Route } from "./+types/cohorts.$id";
import { requireRole } from "~/server/auth.server";
import { getEnabledTools, getToolBySlug } from "~/lib/registry";
import type { Role } from "~/lib/registry/access";
import { listModels } from "~/lib/ai/models";
import { getSelectableModelIds } from "~/server/availability.server";
import {
  allowedModelsOf,
  allowedSlugsOf,
  canManageCohort,
  cohortConfig,
  createCohort,
  deleteCohort,
  getCohort,
  getCohortTeacherIds,
  updateCohort,
} from "~/server/repositories/cohorts.server";
import { createInvitesForCohort } from "~/server/repositories/users.server";
import { getProfile, listProfiles } from "~/server/repositories/profiles.server";
import { EQF_LEVELS, isEqfLevel } from "~/lib/context/eqf";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import type { InputField } from "~/lib/registry/types";
import { Button, Card, HelpText, Input, Label, Select, Textarea } from "~/components/ui";
import { ConfirmDialog } from "~/components/ConfirmDialog";

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.data as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.cohorts.createHeading} — ${m.appName}` }];
}

/** The student tutors a cohort can provision, sourced from the registry (not hardcoded). */
function studentTutors() {
  return getEnabledTools()
    .filter((tl) => tl.userType === "student")
    .map((tl) => ({ slug: tl.slug, name: tl.name, inputs: tl.inputs }));
}

/**
 * The paid (non-local) catalog models the editor may assign to a cohort (P13):
 * the editor's OWN effective selectable set, minus free local/CLI models (which
 * students may use regardless). A cohort's model set is ⊆ this, re-capped by the
 * instance at read time — so a cohort can only ever narrow the teacher's models.
 */
async function assignableCohortModels(user: {
  id: string;
  role: Role;
}): Promise<{ id: string; displayName: string }[]> {
  const effective = await getSelectableModelIds(user);
  return listModels()
    .filter((m) => m.clientSelectable && !m.local && effective.has(m.id))
    .map((m) => ({ id: m.id as string, displayName: m.displayName }));
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireRole(request, "teacher", "admin");
  const isNew = params.id === "new";
  const cohort = isNew ? null : await getCohort(params.id);
  // A cohort is managed by its creator, its assigned co-teachers (Phase 4), or an
  // admin. Anyone else can't tell it from a missing one.
  if (!isNew) {
    if (!cohort) throw new Response("Not Found", { status: 404 });
    if (!canManageCohort(user, cohort, await getCohortTeacherIds(cohort.id))) {
      throw new Response("Not Found", { status: 404 });
    }
  }
  const profiles = (await listProfiles(user.id)).map((p) => ({ id: p.id, name: p.name }));
  // Per-cohort model set (P13): the editor's assignable catalog + the cohort's
  // current selection (null = inherit = all of the editor's models).
  const modelCatalog = await assignableCohortModels(user);
  const cohortModels = cohort ? allowedModelsOf(cohort) : null;
  return {
    mode: isNew ? ("new" as const) : ("manage" as const),
    // Deleting a cohort is admin-only (teachers manage but never delete).
    canDelete: !isNew && user.role === "admin",
    tutors: studentTutors(),
    profiles,
    models: { catalog: modelCatalog, selected: cohortModels ? [...cohortModels] : null },
    cohort: cohort
      ? {
          id: cohort.id,
          name: cohort.name,
          allowedToolSlugs: [...allowedSlugsOf(cohort)],
          config: cohortConfig(cohort),
          contextProfileId: cohort.contextProfileId,
          contextEqf: cohort.contextEqf,
          activeUntil: cohort.activeUntil,
        }
      : null,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await requireRole(request, "teacher", "admin");
  const m = getMessages(getLocale(request));
  const fd = await request.formData();

  // Deleting a cohort is admin-only. Student accounts survive — only their
  // membership link is dropped (see deleteCohort).
  if (fd.get("intent") === "deleteCohort") {
    if (user.role !== "admin" || params.id === "new") {
      throw new Response("Forbidden", { status: 403 });
    }
    const existing = await getCohort(params.id);
    if (existing) await deleteCohort(existing.id);
    throw redirect("/cohorts");
  }

  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: m.cohorts.errorName };

  // Only registry-known student tutors may be provisioned (never trust the body).
  const studentSlugs = new Set(studentTutors().map((tl) => tl.slug));
  const allowedToolSlugs = fd
    .getAll("tools")
    .map(String)
    .filter((s) => studentSlugs.has(s));
  if (allowedToolSlugs.length === 0) return { error: m.cohorts.errorNoTools };

  // Per-tutor sandbox config, read from the namespaced fields `cfg.<slug>.<field>`.
  const config: Record<string, { values: Record<string, string> }> = {};
  for (const slug of allowedToolSlugs) {
    const values: Record<string, string> = {};
    for (const field of getToolBySlug(slug)?.inputs ?? []) {
      const raw = fd.get(`cfg.${slug}.${field.name}`);
      if (typeof raw === "string" && raw.trim()) values[field.name] = raw.trim();
    }
    config[slug] = { values };
  }

  // Per-cohort model set (P13): keep only ids the editor may actually assign
  // (their effective, non-local catalog). Empty OR all-selected = inherit (null);
  // a strict subset narrows. Never widens — re-capped by the instance at read time.
  const modelCatalogIds = new Set((await assignableCohortModels(user)).map((mdl) => mdl.id));
  const selectedModels = [
    ...new Set(
      fd
        .getAll("models")
        .map(String)
        .filter((id) => modelCatalogIds.has(id)),
    ),
  ];
  const allowedModelIds =
    selectedModels.length === 0 || selectedModels.length === modelCatalogIds.size
      ? null
      : selectedModels;

  // Level source (mutually exclusive): a full context profile, a bare EQF number,
  // or none. The cohort profile is injected for members via membership-authorised
  // read (getProfileForMember bypasses owner-scoping), so the teacher may only
  // attach a profile *they own* — otherwise they could leak a colleague's profile
  // to their students by referencing its id.
  const contextSource = String(fd.get("contextSource") ?? "none");
  let contextProfileId: string | null = null;
  let contextEqf: number | null = null;
  if (contextSource === "profile") {
    contextProfileId = String(fd.get("contextProfileId") ?? "").trim() || null;
    if (contextProfileId && !(await getProfile(user.id, contextProfileId))) {
      return { error: m.cohorts.errorInvalidProfile };
    }
  } else if (contextSource === "eqf") {
    const eqf = Number(fd.get("contextEqf"));
    contextEqf = isEqfLevel(eqf) ? eqf : null;
  }
  const activeUntilRaw = String(fd.get("activeUntil") ?? "").trim();
  const activeUntil = activeUntilRaw ? new Date(activeUntilRaw) : null;
  const expiryDays = Math.min(90, Math.max(1, Number(fd.get("expiryDays") ?? "7") || 7));

  // Recipients: one identity-bound invite per email + N link-only bearer invites.
  // Required to *create* a cohort (a cohort exists to invite students into) but
  // optional when *managing* one — changing tools/level must not force a fresh
  // invite batch. A manage save with recipients edits AND invites in one step.
  const emails = String(fd.get("emails") ?? "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const linkCount = Math.min(200, Math.max(0, Number(fd.get("linkCount") ?? "0") || 0));
  const recipients: { email?: string }[] = [
    ...emails.map((email) => ({ email })),
    ...Array.from({ length: linkCount }, () => ({}) as { email?: string }),
  ];
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
  const origin = new URL(request.url).origin;
  const toLinks = (invites: { token: string; email: string | null }[]) =>
    invites.map((inv) => ({ url: `${origin}/invite/${inv.token}`, email: inv.email }));

  // ── Create a brand-new cohort (recipients required) ─────────────────────────
  if (params.id === "new") {
    if (recipients.length === 0) return { error: m.cohorts.errorNoRecipients };
    const cohort = await createCohort({
      createdByUserId: user.id,
      name,
      allowedToolSlugs,
      config,
      allowedModelIds,
      contextProfileId,
      contextEqf,
      activeUntil,
    });
    const invites = await createInvitesForCohort(cohort.id, user.id, recipients, expiresAt);
    return { cohortId: cohort.id, links: toLinks(invites) };
  }

  // ── Edit an existing cohort ─────────────────────────────────────────────────
  // Authorise (creator, assigned co-teacher, or admin) before any side effect.
  const existing = await getCohort(params.id);
  if (!existing) throw new Response("Not Found", { status: 404 });
  if (!canManageCohort(user, existing, await getCohortTeacherIds(existing.id))) {
    throw new Response("Not Found", { status: 404 });
  }

  // Guard a colleague's context profile: an editor who does not own the cohort's
  // current profile can't see it in their dropdown, so an untouched "profile"
  // source submits an empty id. Preserve the existing profile rather than silently
  // wiping it — removing the level stays possible via the explicit "no level".
  let finalProfileId = contextProfileId;
  let finalEqf = contextEqf;
  if (contextSource === "profile" && !contextProfileId && existing.contextProfileId) {
    const ownsExisting = await getProfile(user.id, existing.contextProfileId);
    if (!ownsExisting) {
      finalProfileId = existing.contextProfileId;
      finalEqf = null;
    }
  }

  await updateCohort(params.id, {
    name,
    allowedToolSlugs,
    config,
    allowedModelIds,
    contextProfileId: finalProfileId,
    contextEqf: finalEqf,
    activeUntil,
  });

  // Pure edit unless recipients were supplied — then invite them in the same save.
  if (recipients.length === 0) return { saved: true as const };
  const invites = await createInvitesForCohort(params.id, user.id, recipients, expiresAt);
  return { saved: true as const, links: toLinks(invites) };
}

export default function CohortForm({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const { mode, canDelete, tutors, profiles, cohort, models } = loaderData;

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(cohort?.allowedToolSlugs ?? []),
  );
  const toggle = (slug: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  // How the cohort's level is set: a full context profile, a bare EQF number, or
  // none. Defaults to whichever the loaded cohort already uses.
  const [contextSource, setContextSource] = useState<"none" | "profile" | "eqf">(() =>
    cohort?.contextProfileId ? "profile" : cohort?.contextEqf != null ? "eqf" : "none",
  );

  const error = actionData?.error;
  const links = actionData?.links;
  const saved = actionData?.saved;

  // The cohort levels members by a profile the current editor doesn't own (e.g. an
  // admin editing a colleague's cohort). It can't appear in their dropdown, so the
  // form flags it as read-only; the action preserves it on save (see `action`).
  const foreignProfile = Boolean(
    cohort?.contextProfileId && !profiles.some((p) => p.id === cohort.contextProfileId),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/cohorts"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t.cohorts.backToList}
      </Link>
      <h1 className="mt-3 font-display text-2xl font-medium tracking-tight text-slate-900">
        {mode === "new" ? t.cohorts.createHeading : t.cohorts.manageHeading}
      </h1>
      <p className="mt-2 text-slate-600">{t.cohorts.intro}</p>

      {mode === "manage" && cohort && (
        <Link
          to={`/cohorts/${cohort.id}/insight`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100"
        >
          <LineChart className="size-4" aria-hidden />
          {t.cohorts.insightCta}
        </Link>
      )}

      {links ? (
        <GeneratedLinks links={links} />
      ) : (
        <Card className="mt-6 p-6">
          {error && (
            <p
              id="cohort-error"
              role="alert"
              className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {saved && (
            <p
              role="status"
              className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            >
              {t.cohorts.saved}
            </p>
          )}
          <Form method="post" className="space-y-6">
            <div>
              <Label htmlFor="name" required>
                {t.cohorts.nameLabel}
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={cohort?.name ?? ""}
                placeholder={t.cohorts.namePlaceholder}
                className="mt-1"
                aria-describedby={error ? "cohort-error" : undefined}
              />
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-slate-800">
                {t.cohorts.tutorsLegend}
              </legend>
              <HelpText>{t.cohorts.tutorsHint}</HelpText>
              <div className="space-y-3">
                {tutors.map((tutor) => (
                  <TutorRow
                    key={tutor.slug}
                    slug={tutor.slug}
                    label={loc(tutor.name, locale)}
                    inputs={tutor.inputs}
                    checked={selected.has(tutor.slug)}
                    onToggle={() => toggle(tutor.slug)}
                    configLabel={t.cohorts.configFor}
                    values={cohort?.config?.[tutor.slug]?.values ?? {}}
                    locale={locale}
                  />
                ))}
              </div>
            </fieldset>

            {models.catalog.length > 0 && (
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-slate-800">
                  {t.cohorts.modelsLegend}
                </legend>
                <HelpText>{t.cohorts.modelsHint}</HelpText>
                <div className="space-y-2">
                  {models.catalog.map((mdl) => (
                    <label
                      key={mdl.id}
                      className="flex items-center gap-2.5 text-sm text-slate-800"
                    >
                      <input
                        type="checkbox"
                        name="models"
                        value={mdl.id}
                        defaultChecked={
                          models.selected === null || models.selected.includes(mdl.id)
                        }
                        className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                      />
                      {mdl.displayName}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-slate-800">
                {t.cohorts.contextSourceLegend}
              </legend>
              <HelpText>{t.cohorts.contextSourceHint}</HelpText>
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 text-sm text-slate-800">
                  <input
                    type="radio"
                    name="contextSource"
                    value="none"
                    checked={contextSource === "none"}
                    onChange={() => setContextSource("none")}
                    className="size-4 border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                  />
                  {t.cohorts.contextNone}
                </label>
                <label className="flex items-center gap-2.5 text-sm text-slate-800">
                  <input
                    type="radio"
                    name="contextSource"
                    value="profile"
                    checked={contextSource === "profile"}
                    onChange={() => setContextSource("profile")}
                    className="size-4 border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                  />
                  {t.cohorts.contextProfile}
                </label>
                <label className="flex items-center gap-2.5 text-sm text-slate-800">
                  <input
                    type="radio"
                    name="contextSource"
                    value="eqf"
                    checked={contextSource === "eqf"}
                    onChange={() => setContextSource("eqf")}
                    className="size-4 border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                  />
                  {t.cohorts.contextEqf}
                </label>
              </div>

              {contextSource === "profile" && (
                <div>
                  <Label htmlFor="contextProfileId">{t.cohorts.profileLabel}</Label>
                  <Select
                    id="contextProfileId"
                    name="contextProfileId"
                    defaultValue={foreignProfile ? "" : (cohort?.contextProfileId ?? "")}
                    className="mt-1"
                  >
                    <option value="">{t.cohorts.profileNone}</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  {foreignProfile && <HelpText>{t.cohorts.levelManagedByOwner}</HelpText>}
                </div>
              )}

              {contextSource === "eqf" && (
                <div>
                  <Label htmlFor="contextEqf">{t.cohorts.eqfLabel}</Label>
                  <Select
                    id="contextEqf"
                    name="contextEqf"
                    defaultValue={cohort?.contextEqf != null ? String(cohort.contextEqf) : "6"}
                    className="mt-1"
                  >
                    {EQF_LEVELS.map((e) => (
                      <option key={e.level} value={e.level}>
                        {loc(e.label, locale)}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </fieldset>

            <div>
              <Label htmlFor="activeUntil">{t.cohorts.activeUntilLabel}</Label>
              <Input
                id="activeUntil"
                name="activeUntil"
                type="date"
                defaultValue={toDateInput(cohort?.activeUntil)}
                className="mt-1 max-w-xs"
              />
            </div>

            <fieldset className="space-y-3 border-t border-slate-100 pt-5">
              <legend className="text-sm font-semibold text-slate-800">
                {t.cohorts.recipientsLegend}
              </legend>
              {mode === "manage" && <HelpText>{t.cohorts.recipientsOptional}</HelpText>}
              <div>
                <Label htmlFor="emails">{t.cohorts.recipientsEmailsLabel}</Label>
                <Textarea id="emails" name="emails" rows={3} className="mt-1" />
                <HelpText>{t.cohorts.recipientsEmailsHint}</HelpText>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="linkCount">{t.cohorts.linkCountLabel}</Label>
                  <Input
                    id="linkCount"
                    name="linkCount"
                    type="number"
                    min={0}
                    max={200}
                    defaultValue={0}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="expiryDays">{t.cohorts.expiryLabel}</Label>
                  <Input
                    id="expiryDays"
                    name="expiryDays"
                    type="number"
                    min={1}
                    max={90}
                    defaultValue={7}
                    className="mt-1"
                  />
                </div>
              </div>
            </fieldset>

            <Button type="submit" disabled={busy} className="w-full">
              {mode === "new" ? t.cohorts.submitCreate : t.cohorts.saveChanges}
            </Button>
          </Form>
        </Card>
      )}

      {mode === "manage" && canDelete && (
        <section
          aria-labelledby="cohort-danger"
          className="mt-8 rounded-2xl border border-red-200 bg-red-50/50 p-6"
        >
          <h2 id="cohort-danger" className="font-semibold text-red-800">
            {t.cohorts.deleteHeading}
          </h2>
          <p className="mt-2 text-sm text-red-700">{t.cohorts.deleteIntro}</p>
          <div className="mt-4">
            <ConfirmDialog
              triggerLabel={t.cohorts.deleteHeading}
              title={t.cohorts.deleteTitle}
              description={t.cohorts.deleteBody}
              confirmLabel={t.cohorts.deleteConfirm}
              cancelLabel={t.confirm.cancel}
              fields={{ intent: "deleteCohort" }}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function TutorRow({
  slug,
  label,
  inputs,
  checked,
  onToggle,
  configLabel,
  values,
  locale,
}: {
  slug: string;
  label: string;
  inputs: InputField[];
  checked: boolean;
  onToggle: () => void;
  configLabel: string;
  values: Record<string, string>;
  locale: Locale;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center gap-2.5">
        <input
          type="checkbox"
          id={`tool-${slug}`}
          name="tools"
          value={slug}
          checked={checked}
          onChange={onToggle}
          className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
        />
        <label htmlFor={`tool-${slug}`} className="text-sm font-medium text-slate-800">
          {label}
        </label>
      </div>
      {checked && inputs.length > 0 && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 pl-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {configLabel}
          </p>
          {inputs.map((field) => (
            <ConfigField
              key={field.name}
              slug={slug}
              field={field}
              defaultValue={values[field.name] ?? ""}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigField({
  slug,
  field,
  defaultValue,
  locale,
}: {
  slug: string;
  field: InputField;
  defaultValue: string;
  locale: Locale;
}) {
  const id = `cfg-${slug}-${field.name}`;
  const name = `cfg.${slug}.${field.name}`;
  const label = loc(field.label, locale);
  const placeholder = field.placeholder ? loc(field.placeholder, locale) : undefined;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {field.kind === "textarea" ? (
        <Textarea
          id={id}
          name={name}
          rows={field.rows ?? 2}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="mt-1"
        />
      ) : field.kind === "select" ? (
        <Select id={id} name={name} defaultValue={defaultValue} className="mt-1">
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {loc(o.label, locale)}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          id={id}
          name={name}
          type={field.kind === "number" ? "number" : "text"}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="mt-1"
        />
      )}
    </div>
  );
}

function GeneratedLinks({ links }: { links: { url: string; email: string | null }[] }) {
  const t = useT();
  return (
    <Card className="mt-6 p-6">
      <h2 className="font-semibold text-slate-900">{t.cohorts.linksHeading}</h2>
      <p className="mt-1 text-sm text-slate-600">{t.cohorts.linksHint}</p>
      <ul className="mt-4 space-y-2">
        {links.map((link) => (
          <li
            key={link.url}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-slate-500">
                {link.email ?? t.cohorts.linkOnly}
              </span>
              <span className="block truncate font-mono text-xs text-slate-700">{link.url}</span>
            </span>
            <CopyButton url={link.url} label={t.cohorts.copy} />
          </li>
        ))}
      </ul>
      <Link
        to="/cohorts"
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t.cohorts.backToList}
      </Link>
    </Card>
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

/** Format a Date (or ms) into a `yyyy-mm-dd` value for a <input type="date">. */
function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
