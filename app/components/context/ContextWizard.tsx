/** Step-by-step guided creation of a context profile. All steps live inside a
 * single <Form>; inactive steps are `hidden` (not unmounted) so their values
 * persist and submit together. Shares its controls + the route action with
 * `ContextForm` — only the presentation differs. */
import { useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { ArrowLeft, ArrowRight, Check, Star } from "lucide-react";
import { Button } from "~/components/ui";
import { cn } from "~/lib/utils";
import { defaultPackValues } from "~/lib/context/packs";
import { useT } from "~/lib/i18n/useT";
import type { Messages } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import {
  NameField,
  ProgrammeField,
  DomainSelect,
  CourseField,
  StudyYearField,
  EqfField,
  CompetenciesField,
  ProfessionalContextField,
  ToolsField,
  NotesField,
  DomainFields,
  CustomFieldsEditor,
} from "./ContextFields";

const TOTAL = 4;

/** A short recap of what the user entered, read from the live form on step 4. */
function buildSummary(fd: FormData, t: Messages): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const add = (label: string, v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    if (s) out.push({ label, value: s });
  };
  add(t.settings.name, fd.get("name"));
  add(t.settings.programme, fd.get("programme"));
  add(t.settings.domain, fd.get("domain"));
  add(t.settings.course, fd.get("courseName"));
  add(t.settings.studyYear, fd.get("studyYear"));
  const eqf = fd.get("eqf");
  if (eqf) out.push({ label: t.settings.eqfOptional, value: `EQF ${eqf}` });

  let packCount = 0;
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("pack.") && String(v).trim()) packCount++;
  }
  if (packCount) out.push({ label: t.settings.packHeading, value: String(packCount) });

  const customCount = fd.getAll("customLabel").filter((v) => String(v).trim()).length;
  if (customCount) out.push({ label: t.settings.customHeading, value: String(customCount) });
  return out;
}

export function ContextWizard({ onCancel }: { onCancel: () => void }) {
  const t = useT();
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [studyYear, setStudyYear] = useState("");
  const [summary, setSummary] = useState<{ label: string; value: string }[]>([]);

  const titles = [
    t.settings.step1Title,
    t.settings.step2Title,
    t.settings.step3Title,
    t.settings.step4Title,
  ];

  const goNext = () => {
    const next = Math.min(step + 1, TOTAL - 1);
    if (next === TOTAL - 1 && formRef.current) {
      setSummary(buildSummary(new FormData(formRef.current), t));
    }
    setStep(next);
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));
  const canNext = step !== 0 || name.trim().length > 0;

  return (
    <Form method="post" ref={formRef} className="space-y-5">
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

      {/* Step 1 — Basics */}
      <div hidden={step !== 0} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NameField value={name} onChange={setName} required={false} />
          <ProgrammeField />
          <DomainSelect value={domain} onChange={setDomain} />
          <CourseField />
        </div>
      </div>

      {/* Step 2 — Level & domain framework */}
      <div hidden={step !== 1} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StudyYearField value={studyYear} onChange={setStudyYear} />
          <EqfField defaultValue={6} />
        </div>
        <DomainFields
          key={domain || "none"}
          domain={domain}
          values={defaultPackValues(domain, studyYear ? Number(studyYear) : undefined)}
        />
      </div>

      {/* Step 3 — Custom fields & context */}
      <div hidden={step !== 2} className="space-y-4">
        <CustomFieldsEditor />
        <CompetenciesField />
        <ProfessionalContextField />
        <ToolsField />
        <NotesField />
      </div>

      {/* Step 4 — Finish */}
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
          <Button type="submit" name="intent" value="create" disabled={busy || !name.trim()}>
            <Check className="size-4" aria-hidden /> {t.settings.finish}
          </Button>
        )}
      </div>
    </Form>
  );
}
