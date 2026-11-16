import { useEffect, useId, useState } from "react";
import { Button, Input, Label } from "~/components/ui";
import { useToast } from "~/components/Toast";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { markerQuestion, markersIn } from "~/lib/portfolio/openSpots";

/**
 * Every open spot of the chapter as a question of its own: the teacher answers in a few words
 * and the answer takes the marker's place in the text. Only the editor's text changes; the
 * teacher saves the chapter as usual. The fields have no name, so they never post.
 */
export function OpenSpotFill({
  text,
  onFill,
}: {
  text: string;
  onFill: (index: number, answer: string) => void;
}) {
  const t = useT().portfolioVoice.spots;
  const { showToast } = useToast();
  const base = useId();
  const [focusAt, setFocusAt] = useState<number | null>(null);
  const markers = markersIn(text);
  const fieldId = (i: number) => `${base}-${i}`;

  useEffect(() => {
    if (focusAt === null) return;
    document.getElementById(fieldId(Math.min(focusAt, markers.length - 1)))?.focus();
    setFocusAt(null);
  });

  if (markers.length === 0) return null;
  const fill = (i: number) => {
    const el = document.getElementById(fieldId(i)) as HTMLInputElement | null;
    if (!el?.value.trim()) return;
    onFill(i, el.value);
    setFocusAt(i);
    showToast({ variant: "success", message: t.filled });
  };
  return (
    <section
      aria-labelledby={`${base}-title`}
      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
    >
      <h4 id={`${base}-title`} className="text-sm font-medium text-slate-900">
        {t.title}
      </h4>
      <p className="mt-1 text-sm text-slate-700">{t.intro}</p>
      <ol className="mt-2 space-y-2">
        {markers.map((m, i) => {
          const q = markerQuestion(m);
          // The same marker twice gets its occurrence: a filled spot leaves the others' fields.
          const nth = markers.slice(0, i).filter((x) => x === m).length;
          return (
            <li key={`${m}#${nth}`} className="grid gap-1">
              <Label htmlFor={fieldId(i)}>{q}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id={fieldId(i)}
                  className="min-w-0 flex-1"
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    fill(i);
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  aria-label={fmt(t.fillLabel, { q })}
                  onClick={() => fill(i)}
                >
                  {t.fill}
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
