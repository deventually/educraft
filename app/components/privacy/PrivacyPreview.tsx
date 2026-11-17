import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { Button, Input, Label, Textarea } from "~/components/ui";
import { useToast } from "~/components/Toast";
import { useT } from "~/lib/i18n/useT";
import { ScrollText } from "./ScrollText";
import { fmt } from "~/lib/i18n/format";
import type { Privacy } from "~/lib/hooks/usePrivacy";
import { isKeepWord, type LiveField, type LiveSpan, type NamedPeople } from "~/lib/privacy/live";
import type { PrivacyReviewItem } from "~/lib/streamClient";

interface Props {
  privacy: Privacy;
  /** The text fields as they go, with the label the teacher knows them by. */
  fields: Array<LiveField & { label: string }>;
  /** The tool handles student work: the names to remove are open from the start. */
  studentWork?: boolean;
  /** In a chat: without the intro and the limits, which the tool page already shows. */
  compact?: boolean;
}

/**
 * "Dit gaat naar de AI" (anonymiseerpoort PR 3): under the form, in every tool, the text as it
 * goes, every replacement marked with its code. The engine is pure and runs again after each
 * pause in typing, without sending anything. One click keeps a word; a selected word can be
 * replaced too. Student names stay in the page (`usePrivacy`).
 */
export function PrivacyPreview({ privacy, fields, studentWork = false, compact = false }: Props) {
  const t = useT().privacy;
  const uid = useId();
  const { showToast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);
  const shown = useDeferredValue(fields);
  const found = privacy.preview(shown).filter((f) => f.text.trim() !== "");
  const marked = found.filter((f) => f.spans.length > 0);
  const active = found.reduce((n, f) => n + f.spans.filter((s) => !s.kept).length, 0);
  if (found.length === 0) return null;

  function toggle(span: LiveSpan) {
    if (!span.kept && span.kind === "known" && isKeepWord(span.original))
      showToast({ variant: "info", message: fmt(t.neverSaved, { word: span.original }) });
    privacy.toggle(span);
  }

  function alsoReplace() {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const text = sel?.toString().trim();
    if (!text || !sel?.anchorNode || !previewRef.current?.contains(sel.anchorNode)) return;
    privacy.alsoReplace(text);
  }

  return (
    <section
      aria-labelledby={`${uid}-title`}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-violet-700" aria-hidden />
          <div>
            <h2 id={`${uid}-title`} className="font-medium text-slate-900">
              {t.liveTitle}
            </h2>
            {!compact && <p className="text-sm text-slate-600">{t.liveIntro}</p>}
          </div>
        </div>
        <p className="text-sm font-medium text-slate-700" aria-live="polite">
          {active > 0 ? fmt(t.liveCount, { n: active }) : t.liveNone}
        </p>
      </div>

      <NamedFields named={privacy.named} onNamed={privacy.setNamed} open={studentWork} />

      {marked.length > 0 && (
        <>
          <div ref={previewRef} className="space-y-3">
            {marked.map((f) => (
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
                <ScrollText className="max-h-64">
                  <Marked text={f.text} spans={f.spans} onToggle={toggle} hintId={`${uid}-hint`} />
                </ScrollText>
              </section>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id={`${uid}-hint`} className="text-xs text-slate-600">
              {t.alsoReplaceHint}
            </p>
            <Button type="button" size="sm" variant="secondary" onClick={alsoReplace}>
              {t.alsoReplace}
            </Button>
          </div>
        </>
      )}

      {privacy.never.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-medium text-slate-700">{t.neverTitle}:</span>
          {privacy.never.map((word) => (
            <button
              key={word}
              type="button"
              aria-label={fmt(t.neverRemove, { word })}
              onClick={() => privacy.forget(word)}
              className="inline-flex min-h-6 items-center gap-1 rounded-full bg-slate-100 px-2 text-slate-800 ring-1 ring-slate-300 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
            >
              {word} <X className="size-3" aria-hidden />
            </button>
          ))}
        </div>
      )}

      {!compact && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{t.limits}</p>
      )}
    </section>
  );
}

const lines = (s: string) => s.split("\n").filter((l) => l.trim()).length;

/** Who must go: student, number, company, supervisors, other words. Page memory only. */
function NamedFields({
  named,
  onNamed,
  open,
}: {
  named: NamedPeople;
  onNamed: (n: NamedPeople) => void;
  open: boolean;
}) {
  const t = useT().privacy;
  const uid = useId();
  const [isOpen, setOpen] = useState(open);
  const set = (key: keyof NamedPeople) => (e: { target: { value: string } }) =>
    onNamed({ ...named, [key]: e.target.value });
  const input = (key: keyof NamedPeople, label: string, placeholder?: string) => (
    <div>
      <Label htmlFor={`${uid}-${key}`} className="mb-1">
        {label}
      </Label>
      <Input
        id={`${uid}-${key}`}
        value={named[key]}
        placeholder={placeholder}
        onChange={set(key)}
        autoComplete="off"
      />
    </div>
  );
  const area = (key: "supervisors" | "extra", label: string) => (
    <div>
      <Label htmlFor={`${uid}-${key}`} className="mb-1">
        {label}
      </Label>
      <Textarea
        id={`${uid}-${key}`}
        rows={Math.max(2, lines(named[key]) + 1)}
        value={named[key]}
        onChange={set(key)}
      />
    </div>
  );
  return (
    <details
      open={isOpen}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded-lg border border-slate-200"
    >
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600">
        {t.namedTitle}
      </summary>
      <div className="space-y-3 border-t border-slate-100 p-3">
        <p className="text-xs text-slate-600">{t.namedIntro}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {input("student", t.student)}
          {input("studentNumber", t.studentNumber)}
          {input("company", t.company)}
          {input("companyDescription", t.companyDescription, t.companyDescriptionPlaceholder)}
          {area("supervisors", t.supervisors)}
          {area("extra", t.extra)}
        </div>
      </div>
    </details>
  );
}

function Marked({
  text,
  spans,
  onToggle,
  hintId,
}: {
  text: string;
  spans: LiveSpan[];
  onToggle: (s: LiveSpan) => void;
  /** What a click does; the name itself says the state, so no `aria-pressed` on top. */
  hintId: string;
}) {
  const t = useT().privacy;
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const s of spans) {
    if (s.start > at) parts.push(text.slice(at, s.start));
    const on = !s.kept;
    const code = `[${s.code}]`;
    parts.push(
      <button
        key={`${s.start}:${s.end}`}
        type="button"
        aria-label={fmt(on ? t.replaced : t.kept, { original: s.original, code })}
        aria-describedby={hintId}
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

/**
 * The gate found words the teacher did not see (in the context, the course, an earlier step):
 * nothing went yet. Grouped per word; per word Replace (the default) or Do not replace, and only
 * Send lets anything go.
 */
export function PrivacyAskCard({
  items,
  onAnswer,
  onCancel,
}: {
  items: PrivacyReviewItem[];
  onAnswer: (decisions: Record<string, "replace" | "keep">) => void;
  onCancel: () => void;
}) {
  const t = useT().privacy;
  const uid = useId();
  const [choice, setChoice] = useState<Record<string, "replace" | "keep">>(() =>
    Object.fromEntries(items.map((i) => [i.value, "replace" as const])),
  );
  // The card appears instead of the result: focus moves to it, so it is announced, and goes
  // back to where the teacher was (the Generate or Send button) when it closes.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    headingRef.current?.focus();
    return () => {
      if (before?.isConnected) before.focus();
    };
  }, []);
  return (
    <section
      aria-labelledby={`${uid}-title`}
      className="space-y-3 rounded-2xl border border-amber-300 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
        <div>
          <h2
            id={`${uid}-title`}
            ref={headingRef}
            tabIndex={-1}
            className="font-medium text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
          >
            {t.askTitle}
          </h2>
          <p className="text-sm text-slate-600">{t.askIntro}</p>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <fieldset
            key={item.value}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 px-3 py-2"
          >
            {/* A floated legend sits in the row with its choices. */}
            <legend className="float-left mr-auto min-w-40 pr-4 text-sm font-medium text-slate-800">
              {fmt(t.askWord, { value: item.value, n: item.count })}
            </legend>
            {(["replace", "keep"] as const).map((c) => (
              <label key={c} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="radio"
                  name={`${uid}-${i}`}
                  checked={choice[item.value] === c}
                  onChange={() => setChoice((prev) => ({ ...prev, [item.value]: c }))}
                  className="size-4 accent-violet-700"
                />
                {c === "replace" ? t.askReplace : t.askKeep}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => onAnswer(choice)}>
          <ShieldCheck className="size-4" aria-hidden /> {t.askSend}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t.back}
        </Button>
      </div>
    </section>
  );
}
