import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { Trash2, Plus, Star } from "lucide-react";
import type { Route } from "./+types/settings";
import {
  listProfiles,
  createProfile,
  deleteProfile,
} from "~/server/repositories/profiles.server";
import {
  HBO_DOMAINS,
  HBOI_ARCHITECTURE_LAYERS,
  HBOI_ACTIVITIES,
  HBOI_ARCHITECTURE_LAYER_LABELS,
  HBOI_ACTIVITY_LABELS,
  type HboDomain,
  type HboiActivity,
  type HboiArchitectureLayer,
} from "~/lib/context/types";
import { Button, Card, Input, Label, Select, Textarea, Badge } from "~/components/ui";
import { useT, useLocale } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";

export function loader() {
  return { profiles: listProfiles() };
}

export async function action({ request }: Route.ActionArgs) {
  const fd = await request.formData();
  const intent = fd.get("intent");

  if (intent === "delete") {
    deleteProfile(String(fd.get("id")));
    return { ok: true };
  }

  if (intent === "create") {
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      const m = getMessages(getLocale(request));
      return { ok: false, error: m.settings.nameRequired };
    }
    const domain = str(fd.get("domain")) as HboDomain | undefined;
    const eqfRaw = String(fd.get("eqf") ?? "");
    const yearRaw = String(fd.get("studyYear") ?? "");
    const levelRaw = String(fd.get("hboiLevel") ?? "");
    const isIct = domain === "ICT";
    createProfile(
      {
        name,
        programme: str(fd.get("programme")),
        domain,
        courseName: str(fd.get("courseName")),
        studyYear: yearRaw ? (Number(yearRaw) as 1 | 2 | 3 | 4) : undefined,
        eqf: eqfRaw ? (Number(eqfRaw) as 5 | 6 | 7) : undefined,
        competencies: str(fd.get("competencies")),
        professionalContext: str(fd.get("professionalContext")),
        tools: str(fd.get("tools")),
        notes: str(fd.get("notes")),
        architectureLayers: isIct
          ? (fd.getAll("architectureLayers") as HboiArchitectureLayer[])
          : undefined,
        activities: isIct ? (fd.getAll("activities") as HboiActivity[]) : undefined,
        hboiLevel: isIct && levelRaw ? (Number(levelRaw) as 1 | 2 | 3) : undefined,
      },
      fd.get("isDefault") === "on",
    );
    return { ok: true };
  }

  return { ok: false };
}

function str(v: FormDataEntryValue | null): string | undefined {
  const s = String(v ?? "").trim();
  return s || undefined;
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { profiles } = loaderData;
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const [domain, setDomain] = useState<string>("");
  const isIct = domain === "ICT";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">{t.settings.heading}</h1>
      <p className="mt-2 text-slate-600">{t.settings.intro}</p>

      <section className="mt-6 space-y-3">
        {profiles.length === 0 && <p className="text-sm text-slate-500">{t.settings.empty}</p>}
        {profiles.map((p) => (
          <Card key={p.id} className="flex items-start justify-between gap-4 p-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                {p.domain && <Badge>{p.domain}</Badge>}
                {p.eqf && <Badge>EQF {p.eqf}</Badge>}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {[p.programme, p.courseName, p.tools].filter(Boolean).join(" · ")}
              </p>
              {p.competencies && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{p.competencies}</p>
              )}
            </div>
            <Form method="post">
              <input type="hidden" name="id" value={p.id} />
              <Button type="submit" name="intent" value="delete" variant="danger" size="sm" disabled={busy}>
                <Trash2 className="size-4" /> {t.settings.delete}
              </Button>
            </Form>
          </Card>
        ))}
      </section>

      <Card className="mt-8 p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
          <Plus className="size-4 text-violet-600" /> {t.settings.newProfile}
        </h2>
        <Form method="post" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.settings.name} required>
              <Input name="name" required placeholder={t.settings.ph.name} />
            </Field>
            <Field label={t.settings.programme}>
              <Input name="programme" placeholder={t.settings.ph.programme} />
            </Field>
            <Field label={t.settings.domain}>
              <Select
                name="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              >
                <option value="">{t.settings.domainNone}</option>
                {HBO_DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.settings.course}>
              <Input name="courseName" placeholder={t.settings.ph.course} />
            </Field>
            <Field label={t.settings.studyYear}>
              <Select name="studyYear" defaultValue="">
                <option value="">{t.settings.yearNone}</option>
                {[1, 2, 3, 4].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.settings.eqfOptional}>
              <Select name="eqf" defaultValue="">
                <option value="">{t.settings.eqfNone}</option>
                <option value="5">EQF 5</option>
                <option value="6">EQF 6</option>
                <option value="7">EQF 7</option>
              </Select>
            </Field>
          </div>

          <Field label={t.settings.competencies}>
            <Textarea name="competencies" rows={2} placeholder={t.settings.ph.competencies} />
          </Field>
          <Field label={t.settings.professionalContext}>
            <Textarea name="professionalContext" rows={2} placeholder={t.settings.ph.professionalContext} />
          </Field>
          <Field label={t.settings.tools}>
            <Input name="tools" placeholder={t.settings.ph.tools} />
          </Field>

          {isIct && (
            <fieldset className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
                {t.settings.ictPack}
              </legend>
              <Field label={t.settings.level}>
                <Select name="hboiLevel" defaultValue="">
                  <option value="">{t.settings.eqfNone}</option>
                  <option value="1">{fmt(t.settings.levelOption, { n: 1 })}</option>
                  <option value="2">{fmt(t.settings.levelOption, { n: 2 })}</option>
                  <option value="3">{fmt(t.settings.levelOption, { n: 3 })}</option>
                </Select>
              </Field>
              <Field label={t.settings.layers}>
                <CheckGroup
                  name="architectureLayers"
                  options={HBOI_ARCHITECTURE_LAYERS.map((v) => ({
                    value: v,
                    label: loc(HBOI_ARCHITECTURE_LAYER_LABELS[v], locale),
                  }))}
                />
              </Field>
              <Field label={t.settings.activities}>
                <CheckGroup
                  name="activities"
                  options={HBOI_ACTIVITIES.map((v) => ({
                    value: v,
                    label: loc(HBOI_ACTIVITY_LABELS[v], locale),
                  }))}
                />
              </Field>
            </fieldset>
          )}

          <Field label={t.settings.notes}>
            <Textarea name="notes" rows={2} placeholder={t.settings.ph.notes} />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isDefault" className="size-4 rounded border-slate-300 text-violet-600" />
            <Star className="size-4 text-amber-500" /> {t.settings.makeDefault}
          </label>

          <Button type="submit" name="intent" value="create" disabled={busy}>
            {t.settings.save}
          </Button>
        </Form>
      </Card>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label required={required} className="mb-1.5">
        {label}
      </Label>
      {children}
    </div>
  );
}

function CheckGroup({
  name,
  options,
}: {
  name: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((o) => (
        <label
          key={o.value}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          <input type="checkbox" name={name} value={o.value} className="size-4 rounded border-slate-300 text-violet-600" />
          {o.label}
        </label>
      ))}
    </div>
  );
}
