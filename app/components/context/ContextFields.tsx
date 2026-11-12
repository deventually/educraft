/**
 * Shared building blocks for creating OR editing a context profile — used by the
 * step-by-step wizard and the all-on-one-page form. Everything here renders real,
 * named form controls so a single <Form> submit (or a no-JS POST) carries the
 * whole profile; the route action parses it via `parseContextForm`. Fields accept
 * an optional initial value so the form can be pre-filled when editing. The
 * domain-pack block lives in `DomainFields`, custom rows in `CustomFieldsEditor`.
 */
import { ExternalLink } from "lucide-react";
import { getDomainsForTrack, groupOptions, type DomainOption } from "~/lib/context/domains";
import {
  showsProfessionalContext,
  showsPhase,
  showsStudyYear,
  domainFieldLabel,
} from "~/lib/context/relevance";
import {
  SECTORS_INFO,
  TRACKS_BY_SECTOR,
  VO_PHASES,
  defaultLevelForTrack,
  isSector,
  learnerNounChoices,
} from "~/lib/context/sectors";
import { NLQF_LEVELS, NLQF_SOURCE_URL, isNlqfLevel, nlqfToEqf } from "~/lib/context/nlqf";
import { Input, Select, Textarea, HelpText } from "~/components/ui";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc, type LocalizedText } from "~/lib/i18n/localized";
import { Field } from "./Field";

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
export function DomainSelect({
  value,
  onChange,
  country = "NL",
  sector = "hbo",
  track,
  available,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Scope the options to a (country, sector, track) catalogue; hbo ignores track. */
  country?: string;
  sector?: string;
  track?: string;
  /** Per-teacher domain allow-list (Phase 10.3); null/undefined = unrestricted. */
  available?: string[] | null;
}) {
  const t = useT();
  const locale = useLocale();
  const catalogue = getDomainsForTrack(country, sector, track);
  const options =
    available == null ? catalogue : catalogue.filter((d) => available.includes(d.value));
  // Back-compat: a legacy/assigned-away stored value outside the visible options
  // is kept as a selected option so opening + editing a profile doesn't blank it.
  const withLegacy =
    value && !options.some((d) => d.value === value)
      ? [...options, { value, label: value } satisfies DomainOption]
      : options;
  return (
    <Field id="cf-domain" label={loc(domainFieldLabel(sector), locale)}>
      <Select id="cf-domain" name="domain" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t.settings.domainNone}</option>
        {groupOptions(withLegacy).map(({ group, options: opts }) => {
          const items = opts.map((d) => (
            <option key={d.value} value={d.value}>
              {loc(d.label, locale)}
            </option>
          ));
          if (!group) return items;
          const label = loc(group, locale);
          return (
            <optgroup key={label} label={label}>
              {items}
            </optgroup>
          );
        })}
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

/**
 * Fase / vo stage (onderbouw vs bovenbouw) — a vo-only, pedagogically meaningful
 * cut a bare leerjaar can't convey. Self-hides for every other sector.
 */
export function PhaseField({
  sector,
  value,
  onChange,
}: {
  sector: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  if (!showsPhase(sector)) return null;
  return (
    <Field id="cf-phase" label={t.settings.phase}>
      <Select id="cf-phase" name="phase" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t.settings.phaseNone}</option>
        {VO_PHASES.map((p) => (
          <option key={p.value} value={p.value}>
            {loc(p.label, locale)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Numeric study year 1–4 — self-hides outside the year-counting sectors (hbo/mbo). */
export function StudyYearField({
  sector,
  value,
  onChange,
}: {
  sector: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  if (!showsStudyYear(sector)) return null;
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
