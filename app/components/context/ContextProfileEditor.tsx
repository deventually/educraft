/**
 * The single, edit-capable, stepped context-profile editor (Phase 8) —
 * consolidates the old wizard + form + choose-screen. All four steps live inside
 * one <Form>; inactive steps are `hidden` (not unmounted) so their values persist
 * and submit together. Pass `profile` to edit (hidden `id` + `intent="update"`).
 *
 * The whole teaching context is set here: a single grouped "Onderwijstype" picker
 * fixes sector + track and prefills the NLQF level; an explicit NLQF select lets
 * you override it (with a derived-EQF preview + cited source). Sector then scopes
 * the domain options and the framework pack.
 */
import { useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { ArrowLeft, ArrowRight, Check, Star } from "lucide-react";
import { Button } from "~/components/ui";
import { cn } from "~/lib/utils";
import type { ContextProfile } from "~/lib/context/types";
import { defaultPackValues } from "~/lib/context/packs";
import { SECTORS_INFO, TRACKS_BY_SECTOR, isSector } from "~/lib/context/sectors";
import { courseLabel } from "~/lib/context/relevance";
import { NLQF_LEVELS, isNlqfLevel, nlqfToEqf } from "~/lib/context/nlqf";
import { useT, useLocale } from "~/lib/i18n/useT";
import type { Messages } from "~/lib/i18n";
import type { Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";
import {
  NameField,
  CountrySelect,
  OnderwijstypeSelect,
  NationalLevelSelect,
  ProgrammeField,
  DomainSelect,
  CourseField,
  StudyYearField,
  ProfessionalContextField,
  ToolsField,
  PedagogyField,
  LearnerNounField,
  DomainFields,
  CustomFieldsEditor,
} from "./ContextFields";

const TOTAL = 4;

/** A short recap read from the live form on step 4, with resolved labels. */
function buildSummary(
  fd: FormData,
  t: Messages,
  locale: Locale,
): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const add = (label: string, v: string) => {
    if (v.trim()) out.push({ label, value: v.trim() });
  };
  const get = (k: string) => String(fd.get(k) ?? "");

  add(t.settings.name, get("name"));

  const sector = get("sector");
  const track = get("track");
  if (isSector(sector)) {
    const trackLabel = TRACKS_BY_SECTOR[sector].find((tr) => tr.value === track)?.label;
    const parts = [loc(SECTORS_INFO[sector].label, locale)];
    if (trackLabel) parts.push(loc(trackLabel, locale));
    add(t.settings.onderwijstype, parts.join(" · "));
  }
  add(t.settings.programme, get("programme"));
  add(t.settings.course, get("courseName"));

  const level = get("nationalLevel");
  if (isNlqfLevel(level)) {
    const label = NLQF_LEVELS.find((l) => l.level === level)?.label;
    add(
      t.settings.nationalLevel,
      `${label ? loc(label, locale) : level} (EQF ${nlqfToEqf(level).eqf})`,
    );
  }
  add(t.settings.domain, get("domain"));
  add(t.settings.pedagogy, get("pedagogy"));

  let packCount = 0;
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("pack.") && String(v).trim()) packCount++;
  }
  if (packCount) out.push({ label: t.settings.packHeading, value: String(packCount) });

  const customCount = fd.getAll("customLabel").filter((v) => String(v).trim()).length;
  if (customCount) out.push({ label: t.settings.customHeading, value: String(customCount) });
  return out;
}

export function ContextProfileEditor({
  onCancel,
  profile,
  isCurrentDefault = false,
  availableCountries,
  availableSectors,
}: {
  onCancel: () => void;
  /** When set, the editor edits this profile instead of creating a new one. */
  profile?: ContextProfile;
  isCurrentDefault?: boolean;
  availableCountries: string[];
  availableSectors: string[];
}) {
  const t = useT();
  const locale = useLocale();
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const formRef = useRef<HTMLFormElement>(null);
  const editing = profile != null;

  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.name ?? "");
  const [country, setCountry] = useState(profile?.country ?? availableCountries[0] ?? "NL");
  const [sector, setSector] = useState<string>(profile?.sector ?? "");
  const [track, setTrack] = useState(profile?.track ?? "");
  const [nationalLevel, setNationalLevel] = useState(profile?.nationalLevel ?? "");
  const [domain, setDomain] = useState(profile?.domain ?? "");
  const [studyYear, setStudyYear] = useState(
    profile?.studyYear != null ? String(profile.studyYear) : "",
  );
  const [learnerNoun, setLearnerNoun] = useState(profile?.learnerNounOverride ?? "");
  const [summary, setSummary] = useState<{ label: string; value: string }[]>([]);

  // When editing, keep the profile's stored answers; when creating, prefill the
  // pack from the framework (hbo, refined by year).
  const packValues = editing
    ? profile.packValues
    : defaultPackValues(domain, studyYear ? Number(studyYear) : undefined);

  const titles = [
    t.settings.step1Title,
    t.settings.step2Title,
    t.settings.step3Title,
    t.settings.step4Title,
  ];

  const goNext = () => {
    const next = Math.min(step + 1, TOTAL - 1);
    if (next === TOTAL - 1 && formRef.current) {
      setSummary(buildSummary(new FormData(formRef.current), t, locale));
    }
    setStep(next);
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));
  const canNext = step !== 0 || name.trim().length > 0;
  const isHbo = sector === "hbo";

  const onOnderwijstype = (nextSector: string, nextTrack: string, defaultLevel: string) => {
    setSector(nextSector);
    setTrack(nextTrack);
    setNationalLevel(defaultLevel);
    setDomain(""); // a sector switch invalidates the previous domain
  };

  return (
    <Form method="post" ref={formRef} className="space-y-5">
      {editing && <input type="hidden" name="id" value={profile.id} />}
      <input type="hidden" name="sector" value={sector} />
      <input type="hidden" name="track" value={track} />

      <div>
        <div className="flex items-center justify-between text-xs font-medium text-slate-500">
          <span>{fmt(t.settings.stepOf, { n: step + 1, total: TOTAL })}</span>
          <span className="text-slate-700">{titles[step]}</span>
        </div>
        <ol className="mt-2 flex gap-1.5">
          {titles.map((tl, i) => (
            <li
              key={tl}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i <= step ? "bg-violet-500" : "bg-slate-200",
              )}
            >
              <span className="sr-only">{tl}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Step 1 — Basis */}
      <div hidden={step !== 0} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NameField value={name} onChange={setName} required={false} />
          {availableCountries.length > 1 ? (
            <CountrySelect value={country} onChange={setCountry} countries={availableCountries} />
          ) : (
            <input type="hidden" name="country" value={country} />
          )}
          <OnderwijstypeSelect
            value={sector && track ? `${sector}::${track}` : ""}
            onChange={onOnderwijstype}
            sectors={availableSectors}
          />
          <ProgrammeField sector={sector} defaultValue={profile?.programme} />
          <CourseField label={courseLabel(sector)} defaultValue={profile?.courseName} />
        </div>
      </div>

      {/* Step 2 — Niveau & kader */}
      <div hidden={step !== 1} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NationalLevelSelect value={nationalLevel} onChange={setNationalLevel} />
          {isHbo && <StudyYearField value={studyYear} onChange={setStudyYear} />}
          <DomainSelect value={domain} onChange={setDomain} country={country} sector={sector} />
        </div>
        <DomainFields
          key={`${sector}|${domain || "none"}`}
          domain={domain}
          country={country}
          sector={sector}
          values={packValues}
        />
      </div>

      {/* Step 3 — Context & eigen velden */}
      <div hidden={step !== 2} className="space-y-4">
        <ProfessionalContextField
          sector={sector}
          track={track}
          defaultValue={profile?.professionalContext}
        />
        <ToolsField defaultValue={profile?.tools} />
        <PedagogyField defaultValue={profile?.pedagogy} />
        <LearnerNounField sector={sector} value={learnerNoun} onChange={setLearnerNoun} />
        <CustomFieldsEditor initial={profile?.customFields} />
      </div>

      {/* Step 4 — Afronden */}
      <div hidden={step !== 3} className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">{t.settings.recap}</p>
          <dl className="mt-2 space-y-1 text-sm">
            {summary.map((s) => (
              <div key={s.label} className="flex gap-2">
                <dt className="shrink-0 text-slate-500">{s.label}:</dt>
                <dd className="text-slate-800">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={isCurrentDefault}
            className="size-4 rounded border-slate-300 text-violet-600"
          />
          <Star className="size-4 text-amber-500" aria-hidden /> {t.settings.makeDefault}
        </label>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <Button type="button" variant="ghost" onClick={step === 0 ? onCancel : goBack}>
          <ArrowLeft className="size-4" aria-hidden />{" "}
          {step === 0 ? t.settings.cancel : t.settings.back}
        </Button>
        {step < TOTAL - 1 ? (
          <Button type="button" onClick={goNext} disabled={!canNext}>
            {t.settings.next} <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button
            type="submit"
            name="intent"
            value={editing ? "update" : "create"}
            disabled={busy || !name.trim()}
          >
            <Check className="size-4" aria-hidden /> {editing ? t.settings.save : t.settings.finish}
          </Button>
        )}
      </div>
    </Form>
  );
}
