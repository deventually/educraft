/**
 * Shared building blocks for creating OR editing a context profile — used by the
 * step-by-step wizard and the all-on-one-page form. Everything here renders real,
 * named form controls so a single <Form> submit (or a no-JS POST) carries the
 * whole profile; the route action parses it via `parseContextForm`. Fields accept
 * an optional initial value so the form can be pre-filled when editing.
 */
import { useRef, useState } from "react";
import { X, Plus, RotateCcw, ExternalLink } from "lucide-react";
import type { CustomField, PackFieldValue } from "~/lib/context/types";
import type { PackField } from "~/lib/context/packs";
import { getDomainsForSector } from "~/lib/context/domains";
import { showsProgramme, showsProfessionalContext } from "~/lib/context/relevance";
import { resolveFramework } from "~/lib/context/frameworks";
import { COUNTRY_LABELS, type CountryCode } from "~/lib/context/countries";
import {
  SECTORS_INFO,
  TRACKS_BY_SECTOR,
  defaultLevelForTrack,
  isSector,
  learnerNounChoices,
} from "~/lib/context/sectors";
import { NLQF_LEVELS, NLQF_SOURCE_URL, isNlqfLevel, nlqfToEqf } from "~/lib/context/nlqf";
import { Input, Label, Select, Textarea, HelpText } from "~/components/ui";
import { useT, useLocale } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { loc, type LocalizedText } from "~/lib/i18n/localized";

/** Label + control wrapper with proper htmlFor/id association. */
export function Field({
  id,
  label,
  required,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} required={required} className="mb-1.5">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function NameField({
  value,
  onChange,
  required = true,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Off in the wizard: a `required` control inside a hidden step blocks submit. */
  required?: boolean;
}) {
  const t = useT();
  return (
    <Field id="cf-name" label={t.settings.name} required>
      <Input
        id="cf-name"
        name="name"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.settings.ph.name}
      />
    </Field>
  );
}

/** Opleiding / Programme — self-hides for the vo sector (no such concept there). */
export function ProgrammeField({
  sector,
  defaultValue,
}: {
  sector?: string;
  defaultValue?: string;
}) {
  const t = useT();
  if (!showsProgramme(sector)) return null;
  return (
    <Field id="cf-programme" label={t.settings.programme}>
      <Input
        id="cf-programme"
        name="programme"
        defaultValue={defaultValue}
        placeholder={t.settings.ph.programme}
      />
    </Field>
  );
}

export function DomainSelect({
  value,
  onChange,
  country = "NL",
  sector = "hbo",
}: {
  value: string;
  onChange: (v: string) => void;
  /** Scope the options to a sector's catalogue; defaults to the legacy hbo shape. */
  country?: string;
  sector?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const options = getDomainsForSector(country, sector);
  return (
    <Field id="cf-domain" label={t.settings.domain}>
      <Select id="cf-domain" name="domain" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t.settings.domainNone}</option>
        {options.map((d) => (
          <option key={d.value} value={d.value}>
            {loc(d.label, locale)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Vak / Course — sector-aware label (Subject for vo, Course elsewhere in EN). */
export function CourseField({
  label,
  defaultValue,
}: {
  label?: LocalizedText;
  defaultValue?: string;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <Field id="cf-course" label={label ? loc(label, locale) : t.settings.course}>
      <Input
        id="cf-course"
        name="courseName"
        defaultValue={defaultValue}
        placeholder={t.settings.ph.course}
      />
    </Field>
  );
}

export function StudyYearField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  return (
    <Field id="cf-year" label={t.settings.studyYear}>
      <Select
        id="cf-year"
        name="studyYear"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t.settings.yearNone}</option>
        {[1, 2, 3, 4].map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Country picker (Phase 8) — only rendered by the editor when >1 country is available. */
export function CountrySelect({
  value,
  onChange,
  countries,
}: {
  value: string;
  onChange: (v: string) => void;
  countries: string[];
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <Field id="cf-country" label={t.settings.country}>
      <Select
        id="cf-country"
        name="country"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {countries.map((c) => (
          <option key={c} value={c}>
            {loc(COUNTRY_LABELS[c as CountryCode] ?? c, locale)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/**
 * The one grouped "Onderwijstype" picker: an optgroup per available sector, each
 * option a track. Choosing one sets both `sector` and `track` and hands back the
 * track's prefilled NLQF level. It is a UI driver (no `name`) — the editor renders
 * hidden `sector`/`track` inputs so a single Form submit carries them.
 */
export function OnderwijstypeSelect({
  value,
  onChange,
  sectors,
}: {
  /** `"sector::track"`, or "" when nothing chosen. */
  value: string;
  onChange: (sector: string, track: string, defaultLevel: string) => void;
  sectors: string[];
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <Field id="cf-onderwijstype" label={t.settings.onderwijstype}>
      <Select
        id="cf-onderwijstype"
        value={value}
        onChange={(e) => {
          const [sector = "", track = ""] = e.target.value.split("::");
          onChange(sector, track, defaultLevelForTrack(sector, track) ?? "");
        }}
      >
        <option value="">{t.settings.onderwijstypeNone}</option>
        {sectors.filter(isSector).map((s) => (
          <optgroup key={s} label={loc(SECTORS_INFO[s].label, locale)}>
            {TRACKS_BY_SECTOR[s].map((tr) => (
              <option key={`${s}::${tr.value}`} value={`${s}::${tr.value}`}>
                {loc(tr.label, locale)}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </Field>
  );
}

/**
 * The NLQF level select — the stored source of truth for level. Prefilled from
 * the chosen track, overridable, with a read-only derived-EQF preview (only the
 * EQF number ever reaches a prompt) and a cited nlqf.nl source link.
 */
export function NationalLevelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const derived = isNlqfLevel(value) ? nlqfToEqf(value) : null;
  return (
    <Field id="cf-level" label={t.settings.nationalLevel}>
      <Select
        id="cf-level"
        name="nationalLevel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t.settings.nationalLevelNone}</option>
        {NLQF_LEVELS.map((l) => (
          <option key={l.level} value={l.level}>
            {loc(l.label, locale)}
          </option>
        ))}
      </Select>
      <HelpText>
        {derived && (
          <span className="mr-1.5 font-medium text-slate-700">
            {t.settings.derivedEqf}: EQF {derived.eqf}.
          </span>
        )}
        <a
          href={NLQF_SOURCE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 font-medium text-violet-600 hover:underline"
        >
          <ExternalLink className="size-3" aria-hidden /> {t.settings.viewSource}
        </a>
      </HelpText>
    </Field>
  );
}

/** mbo-only learner-noun override (studenten ↔ deelnemers). Self-hides otherwise. */
export function LearnerNounField({
  sector,
  value,
  onChange,
}: {
  sector: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  const choices = learnerNounChoices(sector);
  if (choices.length === 0) return null;
  const current = choices.includes(value) ? value : choices[0];
  return (
    <Field id="cf-learnernoun" label={t.settings.learnerNoun}>
      <Select
        id="cf-learnernoun"
        name="learnerNounOverride"
        value={current}
        onChange={(e) => onChange(e.target.value)}
      >
        {choices.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Free-text onderwijsconcept / didactic approach (injected verbatim). */
export function PedagogyField({ defaultValue }: { defaultValue?: string }) {
  const t = useT();
  return (
    <Field id="cf-pedagogy" label={t.settings.pedagogy}>
      <Input
        id="cf-pedagogy"
        name="pedagogy"
        defaultValue={defaultValue}
        placeholder={t.settings.ph.pedagogy}
      />
    </Field>
  );
}

/** Beroepspraktijk / Professional field — self-hides for the general havo/vwo tracks. */
export function ProfessionalContextField({
  sector,
  track,
  defaultValue,
}: {
  sector?: string;
  track?: string;
  defaultValue?: string;
}) {
  const t = useT();
  if (!showsProfessionalContext(sector, track)) return null;
  return (
    <Field id="cf-prof" label={t.settings.professionalContext}>
      <Textarea
        id="cf-prof"
        name="professionalContext"
        rows={2}
        defaultValue={defaultValue}
        placeholder={t.settings.ph.professionalContext}
      />
    </Field>
  );
}

export function ToolsField({ defaultValue }: { defaultValue?: string }) {
  const t = useT();
  return (
    <Field id="cf-tools" label={t.settings.tools}>
      <Input
        id="cf-tools"
        name="tools"
        defaultValue={defaultValue}
        placeholder={t.settings.ph.tools}
      />
    </Field>
  );
}

// --- Domain pack -----------------------------------------------------------

/**
 * Recommended, verified fields for the chosen domain. Multiselects start empty
 * — the user ticks only the dimensions their course emphasises (selecting the
 * whole framework would inject undifferentiated noise into every prompt); the
 * level field is suggested from the study year. Each field can be removed;
 * domains without a national framework show an honest note instead. Pass
 * `key={domain}` so switching domains resets selections + removals. `values`
 * pre-selects answers (editing, or the year-derived level).
 */
export function DomainFields({
  domain,
  values,
  country = "NL",
  sector = "hbo",
}: {
  domain: string;
  values?: Record<string, PackFieldValue>;
  /** Scope the framework lookup to a sector; defaults to the legacy hbo shape. */
  country?: string;
  sector?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const pack = resolveFramework(country, sector, domain);
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());

  if (!domain) return null;

  if (!pack) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="text-sm font-semibold text-amber-800">{t.settings.noPackTitle}</p>
        <p className="mt-1 text-sm text-amber-700">{t.settings.noPack}</p>
      </div>
    );
  }

  const visible = pack.fields.filter((f) => !removed.has(f.key));

  return (
    <fieldset className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
        {t.settings.packHeading}
      </legend>
      <p className="text-xs text-slate-600">
        {t.settings.packSource}: {loc(pack.source, locale)}
        {pack.sourceUrl && (
          <a
            href={pack.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-1.5 inline-flex items-center gap-0.5 font-medium text-violet-600 hover:underline"
          >
            <ExternalLink className="size-3" aria-hidden /> {t.settings.viewSource}
          </a>
        )}
      </p>
      {visible.map((field) => (
        <PackFieldControl
          // Level fields re-mount when their year-derived default changes;
          // multiselects keep a stable key so manual edits survive a year change.
          key={field.type === "level" ? `${field.key}:${values?.[field.key] ?? ""}` : field.key}
          field={field}
          value={values?.[field.key]}
          onRemove={() => setRemoved((s) => new Set(s).add(field.key))}
        />
      ))}
      {removed.size > 0 && (
        <button
          type="button"
          onClick={() => setRemoved(new Set())}
          className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline"
        >
          <RotateCcw className="size-3" aria-hidden /> {t.settings.restoreFields}
        </button>
      )}
    </fieldset>
  );
}

function PackFieldControl({
  field,
  value,
  onRemove,
}: {
  field: PackField;
  value?: PackFieldValue;
  onRemove: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const label = loc(field.label, locale);
  const help = field.help ? loc(field.help, locale) : null;

  const removeBtn = (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`${t.settings.removeField}: ${label}`}
      className="text-slate-400 transition-colors hover:text-red-600"
    >
      <X className="size-4" aria-hidden />
    </button>
  );

  if (field.type === "multiselect") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset>
        <legend className="mb-1.5 flex w-full items-center justify-between text-sm font-medium text-slate-800">
          <span>{label}</span>
          {removeBtn}
        </legend>
        <div className="flex flex-wrap gap-2">
          {field.options?.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                name={`pack.${field.key}`}
                value={o.value}
                defaultChecked={selected.includes(o.value)}
                className="size-4 rounded border-slate-300 text-violet-600"
              />
              {loc(o.label, locale)}
            </label>
          ))}
        </div>
        {help && <HelpText>{help}</HelpText>}
      </fieldset>
    );
  }

  const id = `pack-${field.key}`;
  const defaultValue = value != null && !Array.isArray(value) ? String(value) : "";
  const options =
    field.type === "level"
      ? Array.from({ length: field.levelMax ?? 0 }, (_, i) => ({
          value: String(i + 1),
          label: fmt(t.settings.levelOption, { n: i + 1 }),
        }))
      : (field.options ?? []).map((o) => ({ value: o.value, label: loc(o.label, locale) }));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {removeBtn}
      </div>
      <Select id={id} name={`pack.${field.key}`} defaultValue={defaultValue}>
        <option value="">
          {field.type === "level" ? t.settings.levelNone : t.settings.domainNone}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      {help && <HelpText>{help}</HelpText>}
    </div>
  );
}

// --- Custom fields ---------------------------------------------------------

/** Add/remove user-defined label→value rows, available for every domain. */
export function CustomFieldsEditor({ initial = [] }: { initial?: CustomField[] }) {
  const t = useT();
  const idRef = useRef(initial.length);
  const [rows, setRows] = useState<{ id: number; label: string; value: string }[]>(() =>
    initial.map((r, i) => ({ id: i, label: r.label, value: r.value })),
  );

  const addRow = () => {
    const id = idRef.current++;
    setRows((rs) => [...rs, { id, label: "", value: "" }]);
  };
  const removeRow = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));
  const update = (id: number, key: "label" | "value", v: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: v } : r)));

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{t.settings.customHeading}</h3>
        <p className="text-xs text-slate-500">{t.settings.customIntro}</p>
      </div>
      {rows.map((row) => (
        <div key={row.id} className="flex items-start gap-2">
          <Input
            name="customLabel"
            aria-label={t.settings.customLabel}
            value={row.label}
            onChange={(e) => update(row.id, "label", e.target.value)}
            placeholder={t.settings.ph.customLabel}
            className="flex-1"
          />
          <Input
            name="customValue"
            aria-label={t.settings.customValue}
            value={row.value}
            onChange={(e) => update(row.id, "value", e.target.value)}
            placeholder={t.settings.ph.customValue}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => removeRow(row.id)}
            aria-label={t.settings.removeField}
            className="mt-2 text-slate-400 transition-colors hover:text-red-600"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-violet-400 hover:text-violet-700"
      >
        <Plus className="size-4" aria-hidden /> {t.settings.addField}
      </button>
    </div>
  );
}
