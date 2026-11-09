/**
 * The domain-pack block of the context-profile form: the verified framework
 * fields for the chosen domain (or an honest note when there is none).
 */
import { useState } from "react";
import { X, RotateCcw, ExternalLink } from "lucide-react";
import type { PackFieldValue } from "~/lib/context/types";
import type { PackField } from "~/lib/context/packs";
import { resolveFramework } from "~/lib/context/frameworks";
import { Label, Select, HelpText } from "~/components/ui";
import { useT, useLocale } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";

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
      className="text-slate-500 transition-colors hover:text-red-600"
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
