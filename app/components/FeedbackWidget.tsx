import { useId, useState } from "react";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { cn } from "~/lib/utils";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import {
  QUALITY_SCORES,
  TIME_SAVED_OPTIONS,
  type MinutesSaved,
  type QualityScore,
} from "~/lib/pilot";

interface Props {
  /** The generation being rated. Its ownership is verified server-side. */
  generationId: string;
}

type Rating = 1 | -1;

/**
 * Thumbs up/down, then optionally how much time it saved, its quality (1-5) and a
 * comment, for a single generation (pilot feedback). Posts to the
 * `/api/feedback` resource route (which verifies the generation belongs to the
 * caller and upserts one row per user+generation). Self-contained client fetch
 * so it can live anywhere a generation id is known without a route action.
 */
export function FeedbackWidget({ generationId }: Props) {
  const t = useT();
  const [rating, setRating] = useState<Rating | null>(null);
  const [comment, setComment] = useState("");
  const [minutesSaved, setMinutesSaved] = useState<MinutesSaved | null>(null);
  const [quality, setQuality] = useState<QualityScore | null>(null);
  const [sent, setSent] = useState(false);
  const name = useId();

  async function send(next: Rating, withComment: string) {
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          rating: next,
          comment: withComment || undefined,
          minutesSaved: minutesSaved ?? undefined,
          quality: quality ?? undefined,
        }),
      });
    } catch {
      /* best-effort; a failed rating shouldn't disrupt the tester's flow */
    }
  }

  function choose(next: Rating) {
    setRating(next);
    void send(next, comment);
  }

  function submitComment() {
    if (rating === null) return;
    void send(rating, comment);
    setSent(true);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-600">{t.feedback.heading}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => choose(1)}
            aria-pressed={rating === 1}
            aria-label={t.feedback.helpful}
            className={cn(
              "grid size-8 place-items-center rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
              rating === 1
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50",
            )}
          >
            <ThumbsUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => choose(-1)}
            aria-pressed={rating === -1}
            aria-label={t.feedback.notHelpful}
            className={cn(
              "grid size-8 place-items-center rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
              rating === -1
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50",
            )}
          >
            <ThumbsDown className="size-4" aria-hidden />
          </button>
        </div>
        {sent && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
            <Check className="size-3.5" aria-hidden />
            {t.feedback.thanks}
          </span>
        )}
      </div>

      {rating !== null && !sent && (
        <div className="mt-3 space-y-3">
          <fieldset>
            <legend className="text-xs text-slate-500">{t.feedback.timeLegend}</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {TIME_SAVED_OPTIONS.map((m) => (
                <Choice
                  key={m}
                  name={`${name}-time`}
                  value={m}
                  checked={minutesSaved === m}
                  onChange={() => setMinutesSaved(m)}
                  label={
                    m === 0
                      ? t.feedback.timeNone
                      : fmt(m === 60 ? t.feedback.timeMax : t.feedback.timeMinutes, { n: m })
                  }
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs text-slate-500">{t.feedback.qualityLegend}</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {QUALITY_SCORES.map((q) => (
                <Choice
                  key={q}
                  name={`${name}-quality`}
                  value={q}
                  checked={quality === q}
                  onChange={() => setQuality(q)}
                  label={String(q)}
                />
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor={`fb-comment-${generationId}`} className="text-xs text-slate-500">
              {t.feedback.commentLabel}
            </label>
            <textarea
              id={`fb-comment-${generationId}`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder={t.feedback.commentPlaceholder}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <button
              type="button"
              onClick={submitComment}
              className="mt-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              {t.feedback.submit}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One answer as a pill-shaped radio button (native input, so keyboard and SR work). */
function Choice(props: {
  name: string;
  value: number;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-500",
        props.checked
          ? "border-violet-400 bg-violet-50 text-violet-800"
          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      <input
        type="radio"
        name={props.name}
        value={props.value}
        checked={props.checked}
        onChange={props.onChange}
        className="sr-only"
      />
      {props.label}
    </label>
  );
}
