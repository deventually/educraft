import { useEffect, useId, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, HelpText, Input, Label } from "~/components/ui";
import { useToast } from "~/components/Toast";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import type { SendRoundState } from "~/lib/hooks/useSendRound";
import { isKeepWord } from "~/lib/privacy/live";
import type { OverviewPart, OverviewWord } from "~/lib/privacy/overview";
import { PrivacyAskCard } from "./PrivacyPreview";

/** Where a word was found: the first three parts, then how many more. */
function where(labels: readonly string[], more: string): string {
  const shown = labels.slice(0, 3).join(", ");
  return labels.length > 3 ? fmt(more, { list: shown, n: labels.length - 3 }) : shown;
}

/**
 * The overview before sending (anonymiseerpoort step 4), for a screen without a typing moment:
 * every replacement per word ("Jan de Vries (12×)"), with Niet vervangen or Ook vervangen, and a
 * field for a word the list missed. Nothing goes until Versturen. `children` sit above the
 * buttons (a model choice).
 */
function SendOverview({
  round,
  parts,
  children,
}: {
  round: SendRoundState;
  parts: OverviewPart[];
  children?: React.ReactNode;
}) {
  const t = useT().privacy;
  const uid = useId();
  const { showToast } = useToast();
  const [extra, setExtra] = useState("");
  const { privacy } = round;
  const words = privacy.overview(parts);
  const active = words.filter((w) => !w.kept).length;

  // Focus moves to the overview's heading, and back to where the teacher was when it closes.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    headingRef.current?.focus();
    return () => {
      if (before?.isConnected) before.focus();
    };
  }, []);

  function toggle(word: OverviewWord) {
    if (!word.kept && word.kind === "known" && isKeepWord(word.value))
      showToast({ variant: "info", message: fmt(t.neverSaved, { word: word.value }) });
    privacy.toggle(word.span);
  }

  function addExtra() {
    if (!extra.trim()) return;
    privacy.alsoReplace(extra);
    setExtra("");
  }

  return (
    <section
      aria-labelledby={`${uid}-title`}
      className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-violet-700" aria-hidden />
          <div>
            <h2
              id={`${uid}-title`}
              ref={headingRef}
              tabIndex={-1}
              className="font-medium text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
            >
              {t.overviewTitle}
            </h2>
            <p className="max-w-[65ch] text-sm text-slate-600">{t.overviewIntro}</p>
          </div>
        </div>
        <p className="text-sm font-medium text-slate-700" aria-live="polite">
          {active === 0
            ? t.liveNone
            : active === 1
              ? t.overviewCountOne
              : fmt(t.overviewCount, { n: active })}
        </p>
      </div>

      {words.length > 0 && (
        <ul aria-label={t.overviewTitle} className="space-y-2">
          {words.map((w) => {
            const action = w.kept ? t.alsoReplace : t.askKeep;
            return (
              <li
                key={`${w.kind}:${w.value}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
              >
                <div className="min-w-0 text-sm">
                  <p className="break-words text-slate-900">
                    <span className="font-medium">
                      {fmt(t.askWord, { value: w.value, n: w.count })}
                    </span>{" "}
                    {w.kept ? (
                      <span className="text-slate-600">{t.overviewKept}</span>
                    ) : (
                      <span className="rounded bg-violet-100 px-1 text-violet-900">[{w.code}]</span>
                    )}
                  </p>
                  <p className="break-all text-xs text-slate-600">
                    {fmt(t.overviewIn, { where: where(w.labels, t.overviewMore) })}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  aria-label={fmt(t.overviewWordAction, { action, value: w.value })}
                  onClick={() => toggle(w)}
                >
                  {action}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <Label htmlFor={`${uid}-extra`}>{t.overviewAdd}</Label>
        <div className="mt-1 flex flex-wrap gap-2">
          <Input
            id={`${uid}-extra`}
            value={extra}
            autoComplete="off"
            aria-describedby={`${uid}-extra-hint`}
            onChange={(e) => setExtra(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              addExtra();
            }}
            className="max-w-xs"
          />
          <Button type="button" size="sm" variant="secondary" onClick={addExtra}>
            {t.alsoReplace}
          </Button>
        </div>
        <HelpText id={`${uid}-extra-hint`}>{t.overviewAddHint}</HelpText>
      </div>

      {children}

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{t.limits}</p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={round.send}>
          <ShieldCheck className="size-4" aria-hidden /> {t.askSend}
        </Button>
        <Button type="button" variant="secondary" onClick={round.back}>
          {t.back}
        </Button>
      </div>
    </section>
  );
}

/**
 * A screen's round before sending: the gate's question when the server still found something,
 * else the overview while it is open, else nothing.
 */
export function SendRound({
  round,
  children,
}: {
  round: SendRoundState;
  children?: React.ReactNode;
}) {
  const { privacy, parts } = round;
  if (privacy.ask)
    return (
      <div className="mt-4">
        <PrivacyAskCard
          items={privacy.ask.items}
          onAnswer={privacy.answer}
          onCancel={privacy.cancelAsk}
        />
      </div>
    );
  if (!parts) return null;
  return (
    <SendOverview round={round} parts={parts}>
      {children}
    </SendOverview>
  );
}
