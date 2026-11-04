import { useId, useMemo, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Input, Label, Textarea } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import {
  applyRedactions,
  findRedactions,
  type CodeTable,
  type RedactEntry,
  type RedactSpan,
} from "~/lib/privacy/redact";

/** What the teacher typed; kept by the caller so it survives the next generation. */
export interface RedactDraft {
  student: string;
  studentNumber: string;
  company: string;
  companyDescription: string;
  /** One per line. */
  supervisors: string;
  /** One per line. */
  extra: string;
}

export const emptyRedactDraft: RedactDraft = {
  student: "",
  studentNumber: "",
  company: "",
  companyDescription: "",
  supervisors: "",
  extra: "",
};

export interface RedactResult {
  /** Field name → the text with codes, ready to send. */
  values: Record<string, string>;
  /** Code → name; stays in the browser to restore the result. */
  codes: CodeTable;
}

interface Props {
  fields: Array<{ name: string; label: string; text: string }>;
  draft: RedactDraft;
  onDraft: (d: RedactDraft) => void;
  onConfirm: (r: RedactResult) => void;
  onCancel: () => void;
}

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

function draftEntries(d: RedactDraft): RedactEntry[] {
  return [
    { kind: "student" as const, value: d.student },
    { kind: "studentNumber" as const, value: d.studentNumber },
    { kind: "company" as const, value: d.company, description: d.companyDescription },
    ...lines(d.supervisors).map((value) => ({ kind: "supervisor" as const, value })),
  ].filter((e) => e.value.trim());
}

const spanKey = (s: RedactSpan) => `${s.start}:${s.end}:${s.code}`;

/**
 * The anonymise step before sending (brief P24, 24.0b): the teacher names what
 * must go, sees every replacement marked with its code, can undo one or add a
 * word, and only then sends. Pure logic lives in `~/lib/privacy/redact`.
 */
export function RedactReview({ fields, draft, onDraft, onConfirm, onCancel }: Props) {
  const t = useT().privacy;
  const uid = useId();
  // Undone replacements, per field, keyed by position + code.
  const [undone, setUndone] = useState<Record<string, Set<string>>>({});
  const previewRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => draftEntries(draft), [draft]);
  const extra = useMemo(() => lines(draft.extra), [draft.extra]);
  const found = useMemo(
    () => fields.map((f) => ({ ...f, spans: findRedactions(f.text, entries, extra) })),
    [fields, entries, extra],
  );
  const active = found.reduce(
    (n, f) => n + f.spans.filter((s) => !undone[f.name]?.has(spanKey(s))).length,
    0,
  );

  const set = (key: keyof RedactDraft) => (e: { target: { value: string } }) =>
    onDraft({ ...draft, [key]: e.target.value });

  function toggle(field: string, span: RedactSpan) {
    setUndone((prev) => {
      const next = new Set(prev[field]);
      const k = spanKey(span);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return { ...prev, [field]: next };
    });
  }

  function addSelection() {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const text = sel?.toString().trim();
    if (!text || !sel?.anchorNode || !previewRef.current?.contains(sel.anchorNode)) return;
    onDraft({ ...draft, extra: draft.extra ? `${draft.extra}\n${text}` : text });
  }

  function confirm() {
    const values: Record<string, string> = {};
    const codes: CodeTable = {};
    for (const f of found) {
      const skip = new Set(f.spans.flatMap((s, i) => (undone[f.name]?.has(spanKey(s)) ? [i] : [])));
      const r = applyRedactions(f.text, f.spans, skip);
      values[f.name] = r.text;
      Object.assign(codes, r.codes);
    }
    onConfirm({ values, codes });
  }

  const field = (key: keyof RedactDraft, label: string, placeholder?: string) => (
    <div>
      <Label htmlFor={`${uid}-${key}`} className="mb-1">
        {label}
      </Label>
      <Input
        id={`${uid}-${key}`}
        value={draft[key]}
        placeholder={placeholder}
        onChange={set(key)}
        autoComplete="off"
      />
    </div>
  );

  return (
    <section
      aria-labelledby={`${uid}-title`}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-violet-700" aria-hidden />
        <div>
          <h2 id={`${uid}-title`} className="font-medium text-slate-900">
            {t.title}
          </h2>
          <p className="text-sm text-slate-600">{t.intro}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {field("student", t.student)}
        {field("studentNumber", t.studentNumber)}
        {field("company", t.company)}
        {field("companyDescription", t.companyDescription, t.companyDescriptionPlaceholder)}
        <div>
          <Label htmlFor={`${uid}-supervisors`} className="mb-1">
            {t.supervisors}
          </Label>
          <Textarea
            id={`${uid}-supervisors`}
            rows={2}
            value={draft.supervisors}
            onChange={set("supervisors")}
          />
        </div>
        <div>
          <Label htmlFor={`${uid}-extra`} className="mb-1">
            {t.extra}
          </Label>
          <Textarea id={`${uid}-extra`} rows={2} value={draft.extra} onChange={set("extra")} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium text-slate-700" aria-live="polite">
          {fmt(t.count, { n: active })}
        </p>
        <Button type="button" size="sm" variant="secondary" onClick={addSelection}>
          {t.addSelection}
        </Button>
      </div>
      <p className="text-xs text-slate-600">{t.undoHint}</p>

      <div ref={previewRef} className="space-y-3">
        {found.map((f) => (
          <section
            key={f.name}
            aria-labelledby={`${uid}-${f.name}-h`}
            className="rounded-lg border border-slate-200"
          >
            <h3
              id={`${uid}-${f.name}-h`}
              className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              {fmt(t.preview, { field: f.label })}
            </h3>
            {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-reachable */}
            <div tabIndex={0} className="max-h-80 overflow-y-auto px-3 py-2">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                <Marked
                  text={f.text}
                  spans={f.spans}
                  undone={undone[f.name]}
                  onToggle={(s) => toggle(f.name, s)}
                  replaced={t.replaced}
                  kept={t.kept}
                />
              </p>
            </div>
          </section>
        ))}
      </div>

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{t.limits}</p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={confirm}>
          <ShieldCheck className="size-4" aria-hidden /> {t.send}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t.back}
        </Button>
      </div>
    </section>
  );
}

function Marked({
  text,
  spans,
  undone,
  onToggle,
  replaced,
  kept,
}: {
  text: string;
  spans: RedactSpan[];
  undone?: Set<string>;
  onToggle: (s: RedactSpan) => void;
  replaced: string;
  kept: string;
}) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const s of spans) {
    if (s.start > at) parts.push(text.slice(at, s.start));
    const on = !undone?.has(spanKey(s));
    const code = `[${s.code}]`;
    parts.push(
      <button
        key={spanKey(s)}
        type="button"
        aria-pressed={on}
        aria-label={fmt(on ? replaced : kept, { original: s.original, code })}
        onClick={() => onToggle(s)}
        className={
          on
            ? "mx-0.5 rounded bg-violet-100 px-1 text-violet-900 ring-1 ring-violet-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
            : "mx-0.5 rounded px-1 text-slate-800 underline decoration-dotted ring-1 ring-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
        }
      >
        {on ? (
          <>
            <s className="text-violet-700/70">{s.original}</s> <span>{code}</span>
          </>
        ) : (
          s.original
        )}
      </button>,
    );
    at = s.end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}
