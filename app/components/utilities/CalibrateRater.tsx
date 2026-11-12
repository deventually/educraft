import { useId, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, HelpText, Label, Select, Textarea } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { parseRaterText, type RaterTextError, type RubricData } from "~/lib/utilities/rubric";

export interface RaterRow {
  key: number;
  code: string;
  choice: Record<string, string>;
}

let nextKey = 0;
const newRow = (code = "", choice: Record<string, string> = {}): RaterRow => ({
  key: ++nextKey,
  code,
  choice,
});

/**
 * One rater's works for calibrating (P34.2): paste from Excel, or fill in per work. State lives
 * in the parent and in this browser only.
 */
export function CalibrateRater({
  n,
  data,
  rows,
  onChange,
}: {
  n: 1 | 2;
  data: RubricData;
  rows: RaterRow[];
  onChange: (rows: RaterRow[]) => void;
}) {
  const t = useT();
  const s = t.rubricCalibrate;
  const id = useId();
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<RaterTextError[]>([]);
  // A work added with the button gets focus on its code, so the keyboard can go on there.
  const focusKey = useRef<number | null>(null);

  const take = () => {
    const parsed = parseRaterText(data, text);
    setErrors(parsed.errors);
    onChange(parsed.works.map((w) => newRow(w.code, { ...w.choice })));
  };
  const update = (key: number, change: Partial<Omit<RaterRow, "key">>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...change } : r)));

  return (
    <fieldset className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
      <legend className="px-1 font-display text-lg font-medium text-slate-900">
        {fmt(s.rater, { n })}
      </legend>
      <div>
        <Label htmlFor={`${id}-paste`}>{s.paste}</Label>
        <Textarea
          id={`${id}-paste`}
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-describedby={`${id}-hint${errors.length ? ` ${id}-errors` : ""}`}
          className="mt-1 font-mono"
        />
        <HelpText id={`${id}-hint`}>{s.pasteHint}</HelpText>
        {errors.length > 0 && (
          <ul id={`${id}-errors`} className="mt-2 list-disc pl-5 text-sm text-red-700">
            {errors.map((e) => (
              <li key={`${e.line}-${e.kind}-${"criterion" in e ? e.criterion : ""}`}>
                {fmt(s.pasteError[e.kind], { ...e })}
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={take}>
          {s.take}
        </Button>
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{fmt(s.table, { n })}</caption>
            <thead className="text-slate-600">
              <tr>
                <th scope="col" className="py-1 pr-2 font-medium">
                  {s.code}
                </th>
                {data.criteria.map((c) => (
                  <th key={c.id} scope="col" className="py-1 pr-2 font-medium">
                    {c.title}
                  </th>
                ))}
                <td />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className="border-t border-slate-100">
                  <td className="py-1 pr-2">
                    <input
                      ref={(el) => {
                        if (el && focusKey.current === r.key) {
                          focusKey.current = null;
                          el.focus();
                        }
                      }}
                      aria-label={fmt(s.codeOf, { n: i + 1 })}
                      value={r.code}
                      onChange={(e) => update(r.key, { code: e.target.value })}
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  </td>
                  {data.criteria.map((c) => (
                    <td key={c.id} className="py-1 pr-2">
                      <Select
                        aria-label={fmt(s.levelOf, { criterion: c.title, n: i + 1 })}
                        value={r.choice[c.id] ?? ""}
                        onChange={(e) =>
                          update(r.key, { choice: { ...r.choice, [c.id]: e.target.value } })
                        }
                        className="min-w-28 py-1"
                      >
                        <option value="">{s.noLevel}</option>
                        {c.levels.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                  ))}
                  <td className="py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={fmt(s.remove, { n: i + 1 })}
                      onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => {
          const row = newRow();
          focusKey.current = row.key;
          onChange([...rows, row]);
        }}
      >
        <Plus className="size-4" aria-hidden />
        {s.add}
      </Button>
    </fieldset>
  );
}
