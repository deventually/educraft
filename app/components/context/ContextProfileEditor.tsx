/**
 * The context-profile editor: one short page. What matters most is open — name,
 * onderwijstype (which fixes sector + track and prefills the NLQF level),
 * programme, course and study year (vo: phase) — and the default checkbox. The
 * rest (level, domain/profiel with its framework, professional field, tools,
 * onderwijsconcept, learner noun, custom fields) sits in a closed native
 * <details> "Meer details (optioneel)". Closed content stays in the form, so it
 * is always submitted. Pass `profile` to edit (hidden `id` + `intent="update"`).
 */
import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { Check, ChevronDown, Star } from "lucide-react";
import { Button } from "~/components/ui";
import type { ContextProfile } from "~/lib/context/types";
import { DEFAULT_COUNTRY } from "~/lib/context/countries";
import { defaultPackValues } from "~/lib/context/packs";
import { resolveFramework } from "~/lib/context/frameworks";
import { courseLabel, showsDomain } from "~/lib/context/relevance";
import { countFilledDetails } from "~/lib/context/details";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import {
  NameField,
  OnderwijstypeSelect,
  NationalLevelSelect,
  ProgrammeField,
  PhaseField,
  DomainSelect,
  CourseField,
  StudyYearField,
  ProfessionalContextField,
  ToolsField,
  PedagogyField,
  LearnerNounField,
} from "./ContextFields";
import { DomainFields } from "./DomainFields";
import { CustomFieldsEditor } from "./CustomFieldsEditor";

export function ContextProfileEditor({
  onCancel,
  profile,
  isCurrentDefault = false,
  availableSectors,
  availableDomains,
}: {
  onCancel: () => void;
  /** When set, the editor edits this profile instead of creating a new one. */
  profile?: ContextProfile;
  isCurrentDefault?: boolean;
  availableSectors: string[];
  /** Per-teacher domain allow-list (Phase 10.3); null = unrestricted. */
  availableDomains: string[] | null;
}) {
  const t = useT();
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const editing = profile != null;

  const [name, setName] = useState(profile?.name ?? "");
  const [sector, setSector] = useState<string>(profile?.sector ?? "");
  const [track, setTrack] = useState(profile?.track ?? "");
  const [phase, setPhase] = useState(profile?.phase ?? "");
  const [nationalLevel, setNationalLevel] = useState(profile?.nationalLevel ?? "");
  const [domain, setDomain] = useState(profile?.domain ?? "");
  const [studyYear, setStudyYear] = useState(
    profile?.studyYear != null ? String(profile.studyYear) : "",
  );
  const [learnerNoun, setLearnerNoun] = useState(profile?.learnerNounOverride ?? "");

  // When editing, keep the profile's stored answers; when creating, prefill the
  // pack from the framework (refined by year where the pack has a level).
  const packValues = editing
    ? profile.packValues
    : defaultPackValues(
        resolveFramework(DEFAULT_COUNTRY, sector, domain),
        studyYear ? Number(studyYear) : undefined,
      );

  const onOnderwijstype = (nextSector: string, nextTrack: string, defaultLevel: string) => {
    setSector(nextSector);
    setTrack(nextTrack);
    setNationalLevel(defaultLevel);
    setDomain(""); // a sector switch invalidates the previous domain
    if (nextSector !== "vo") setPhase(""); // fase is vo-only
  };

  // Leaving bovenbouw (or clearing the fase) removes the profiel it gated.
  const onPhase = (v: string) => {
    setPhase(v);
    if (v !== "bovenbouw") setDomain("");
  };

  // The profiel is a bovenbouw concept, so it is gated to vo-bovenbouw. But a
  // profile that already carries a domain (a legacy flat-vo profiel, or any hbo
  // profile) must keep showing it so opening + editing never silently blanks a
  // stored value — matching DomainSelect's own out-of-catalogue preservation.
  const showsDomainField = showsDomain(sector, phase) || Boolean(domain);

  const filledCount = editing ? countFilledDetails(profile) : 0;

  return (
    <Form method="post" className="space-y-5">
      {editing && <input type="hidden" name="id" value={profile.id} />}
      <input type="hidden" name="sector" value={sector} />
      <input type="hidden" name="track" value={track} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NameField value={name} onChange={setName} required={false} />
        <OnderwijstypeSelect
          value={sector && track ? `${sector}::${track}` : ""}
          onChange={onOnderwijstype}
          sectors={availableSectors}
        />
        <ProgrammeField sector={sector} defaultValue={profile?.programme} />
        <CourseField label={courseLabel(sector)} defaultValue={profile?.courseName} />
        <StudyYearField sector={sector} value={studyYear} onChange={setStudyYear} />
        <PhaseField sector={sector} value={phase} onChange={onPhase} />
      </div>

      {/* Everything optional, folded away but still part of the form. */}
      <details className="group rounded-xl border border-slate-200 bg-slate-50/60">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 [&::-webkit-details-marker]:hidden">
          <span>{t.settings.moreDetails}</span>
          {filledCount > 0 && (
            <span className="font-normal text-slate-600">
              {fmt(t.settings.moreDetailsFilled, { count: filledCount })}
            </span>
          )}
          <ChevronDown
            className="ml-auto size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="space-y-4 border-t border-slate-200 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NationalLevelSelect value={nationalLevel} onChange={setNationalLevel} />
            {showsDomainField && (
              <DomainSelect
                value={domain}
                onChange={setDomain}
                country={DEFAULT_COUNTRY}
                sector={sector}
                track={track}
                available={availableDomains}
              />
            )}
          </div>
          {showsDomainField && (
            <DomainFields
              key={`${sector}|${domain || "none"}`}
              domain={domain}
              country={DEFAULT_COUNTRY}
              sector={sector}
              values={packValues}
            />
          )}
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
      </details>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={isCurrentDefault}
          className="size-4 rounded border-slate-300 text-violet-600"
        />
        <Star className="size-4 text-amber-500" aria-hidden /> {t.settings.makeDefault}
      </label>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.settings.cancel}
        </Button>
        <Button
          type="submit"
          name="intent"
          value={editing ? "update" : "create"}
          disabled={busy || !name.trim()}
        >
          <Check className="size-4" aria-hidden /> {editing ? t.settings.save : t.settings.finish}
        </Button>
      </div>
    </Form>
  );
}
