import { useState } from "react";
import { Form, Link, useActionData, useNavigation } from "react-router";
import { ArrowLeft, Copy, LineChart } from "lucide-react";
import type { Route } from "./+types/cohorts.$id";
import { requireRole } from "~/server/auth.server";
import { getEnabledTools, getToolBySlug } from "~/lib/registry";
import {
  allowedSlugsOf,
  canManageCohort,
  cohortConfig,
  createCohort,
  getCohort,
  getCohortTeacherIds,
  updateCohort,
} from "~/server/repositories/cohorts.server";
import { createInvitesForCohort } from "~/server/repositories/users.server";
import { getProfile, listProfiles } from "~/server/repositories/profiles.server";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import type { InputField } from "~/lib/registry/types";
import { Button, Card, HelpText, Input, Label, Select, Textarea } from "~/components/ui";

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
  return {
    mode: isNew ? ("new" as const) : ("manage" as const),
    tutors: studentTutors(),
    profiles,
    cohort: cohort
      ? {
          id: cohort.id,
          name: cohort.name,
          allowedToolSlugs: [...allowedSlugsOf(cohort)],
          config: cohortConfig(cohort),
          contextProfileId: cohort.contextProfileId,
          activeUntil: cohort.activeUntil,
        }
      : null,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await requireRole(request, "teacher", "admin");
  const m = getMessages(getLocale(request));
  const fd = await request.formData();

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

  // The cohort profile is injected for members via membership-authorised read
  // (getProfileForMember bypasses owner-scoping). So the teacher may only attach a
  // profile *they own* — otherwise a teacher could leak a colleague's profile to
  // their own students by referencing its id.
  const contextProfileId = String(fd.get("contextProfileId") ?? "").trim() || null;
  if (contextProfileId && !(await getProfile(user.id, contextProfileId))) {
    return { error: m.cohorts.errorInvalidProfile };
  }
  const activeUntilRaw = String(fd.get("activeUntil") ?? "").trim();
  const activeUntil = activeUntilRaw ? new Date(activeUntilRaw) : null;
  const expiryDays = Math.min(90, Math.max(1, Number(fd.get("expiryDays") ?? "7") || 7));

  // Recipients: one identity-bound invite per email + N link-only bearer invites.
  const emails = String(fd.get("emails") ?? "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const linkCount = Math.min(200, Math.max(0, Number(fd.get("linkCount") ?? "0") || 0));
  const recipients: { email?: string }[] = [
    ...emails.map((email) => ({ email })),
    ...Array.from({ length: linkCount }, () => ({}) as { email?: string }),
  ];
  if (recipients.length === 0) return { error: m.cohorts.errorNoRecipients };

  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  // Config granularity = the batch: every invite minted here shares this cohort's
  // tools/config. A single invite is a batch of one with its own cohort.
  let cohortId: string;
  if (params.id === "new") {
    const cohort = await createCohort({
      createdByUserId: user.id,
      name,
      allowedToolSlugs,
      config,
      contextProfileId,
      activeUntil,
    });
    cohortId = cohort.id;
  } else {
    const existing = await getCohort(params.id);
    if (!existing) throw new Response("Not Found", { status: 404 });
    if (!canManageCohort(user, existing, await getCohortTeacherIds(existing.id))) {
      throw new Response("Not Found", { status: 404 });
    }
    await updateCohort(params.id, {
      name,
      allowedToolSlugs,
      config,
      contextProfileId,
      activeUntil,
    });
    cohortId = params.id;
  }

  const invites = await createInvitesForCohort(cohortId, user.id, recipients, expiresAt);
  const origin = new URL(request.url).origin;
  return {
    cohortId,
    links: invites.map((inv) => ({ url: `${origin}/invite/${inv.token}`, email: inv.email })),
  };
}

export default function CohortForm({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const { mode, tutors, profiles, cohort } = loaderData;

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

  const error = actionData?.error;
  const links = actionData?.links;

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

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="contextProfileId">{t.cohorts.profileLabel}</Label>
                <Select
                  id="contextProfileId"
                  name="contextProfileId"
                  defaultValue={cohort?.contextProfileId ?? ""}
                  className="mt-1"
                >
                  <option value="">{t.cohorts.profileNone}</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="activeUntil">{t.cohorts.activeUntilLabel}</Label>
                <Input
                  id="activeUntil"
                  name="activeUntil"
                  type="date"
                  defaultValue={toDateInput(cohort?.activeUntil)}
                  className="mt-1"
                />
              </div>
            </div>

            <fieldset className="space-y-3 border-t border-slate-100 pt-5">
              <legend className="text-sm font-semibold text-slate-800">
                {t.cohorts.recipientsLegend}
              </legend>
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
              {mode === "new" ? t.cohorts.submitCreate : t.cohorts.submitManage}
            </Button>
          </Form>
        </Card>
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
