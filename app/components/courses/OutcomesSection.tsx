import { useId } from "react";
import { Form } from "react-router";
import type { CourseData, LearningOutcome } from "~/lib/courses/types";
import type { DomainPack } from "~/lib/context/packs";
import { packTagLines, TAG_PREFIX } from "~/lib/courses/packTags";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";
import { bloomLabel } from "~/lib/courses/bloom";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { Button, Card, Label, Select, Textarea } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import { BloomSelect, useOutcomeName } from "./fields";
import { ItemActions } from "./ItemActions";
import { ItemTools } from "./ItemTools";
import type { ToolRef } from "~/lib/registry/courseActions";

/** The pack's fields for one outcome (P21.6): checkboxes per multiselect, a select otherwise. */
function PackTagFields({ pack, outcome }: { pack: DomainPack; outcome?: LearningOutcome }) {
  const t = useT();
  const locale = useLocale();
  const id = useId();
  const tags = outcome?.packTags ?? {};
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        {fmt(t.courses.outcomes.tagsSource, { source: loc(pack.source, locale) })}
      </p>
      {pack.fields.map((field) => {
        const name = TAG_PREFIX + field.key;
        const value = tags[field.key];
        const label = loc(field.label, locale);
        if (field.type === "multiselect") {
          const picked = new Set(Array.isArray(value) ? value : []);
          return (
            <fieldset key={field.key}>
              <legend className="text-sm font-medium text-slate-800">{label}</legend>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {field.options?.map((o) => (
                  <label key={o.value} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name={name}
                      value={o.value}
                      defaultChecked={picked.has(o.value)}
                    />
                    {loc(o.label, locale)}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        }
        const options =
          field.type === "level"
            ? Array.from({ length: field.levelMax ?? 1 }, (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
              }))
            : (field.options ?? []).map((o) => ({ value: o.value, label: loc(o.label, locale) }));
        return (
          <div key={field.key} className="sm:w-60">
            <Label htmlFor={`${id}-${field.key}`}>{label}</Label>
            <Select
              id={`${id}-${field.key}`}
              name={name}
              defaultValue={value === undefined || Array.isArray(value) ? "" : String(value)}
              className="mt-1"
            >
              <option value="">{t.courses.outcomes.tagNone}</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        );
      })}
    </div>
  );
}

function OutcomeForm({ outcome, pack }: { outcome?: LearningOutcome; pack?: DomainPack }) {
  const t = useT();
  const id = useId();
  return (
    <Form method="post" className="space-y-3">
      <input type="hidden" name="intent" value={outcome ? "update-outcome" : "add-outcome"} />
      {outcome && <input type="hidden" name="id" value={outcome.id} />}
      <div>
        <Label htmlFor={`${id}-text`}>{t.courses.outcomes.text}</Label>
        <Textarea
          id={`${id}-text`}
          name="text"
          required
          rows={2}
          maxLength={COURSE_LIMITS.text}
          defaultValue={outcome?.text}
          className="mt-1"
        />
      </div>
      <div className="sm:w-60">
        <BloomSelect
          id={`${id}-bloom`}
          name="bloom"
          value={outcome?.bloom}
          label={t.courses.bloomLabel}
        />
      </div>
      {pack && <PackTagFields pack={pack} outcome={outcome} />}
      <Button type="submit" size="sm" variant={outcome ? "secondary" : "primary"}>
        {outcome ? t.courses.save : t.courses.outcomes.add}
      </Button>
    </Form>
  );
}

export function OutcomesSection({
  data,
  pack,
  courseId,
  tools = [],
}: {
  data: CourseData;
  pack?: DomainPack;
  /** With it, every outcome shows its tool buttons (P27.4). */
  courseId?: string;
  tools?: ToolRef[];
}) {
  const t = useT();
  const locale = useLocale();
  const outcomeName = useOutcomeName();
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {t.courses.outcomes.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t.courses.outcomes.intro}</p>
      {data.outcomes.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{t.courses.outcomes.empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.outcomes.map((o, i) => (
            <li key={o.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-slate-900">
                <strong className="font-medium">{outcomeName(i)}</strong> {o.text}
              </p>
              {o.bloom && (
                <p className="text-sm text-slate-600">
                  {t.courses.bloomLabel}: {bloomLabel(o.bloom, locale)}
                </p>
              )}
              {packTagLines(o.packTags, pack, (text) => loc(text, locale)).map((line) => (
                <p key={line} className="text-sm text-slate-600">
                  {line}
                </p>
              ))}
              {courseId && (
                <ItemTools
                  tools={tools}
                  courseId={courseId}
                  itemId={null}
                  itemTitle={outcomeName(i)}
                />
              )}
              <ItemActions name={outcomeName(i)} removeIntent="remove-outcome" id={o.id}>
                <OutcomeForm outcome={o} pack={pack} />
              </ItemActions>
            </li>
          ))}
        </ul>
      )}
      <Card className="mt-3 p-4">
        <OutcomeForm pack={pack} />
      </Card>
    </section>
  );
}
