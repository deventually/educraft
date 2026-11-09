import { useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import type { CustomField } from "~/lib/context/types";
import { Input } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

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
            className="mt-2 text-slate-500 transition-colors hover:text-red-600"
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
