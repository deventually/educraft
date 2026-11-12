import { useId, useState } from "react";
import { Form } from "react-router";
import { CheckCircle2, Copy } from "lucide-react";
import { Button, Card, Label, Textarea } from "~/components/ui";
import { useToast } from "~/components/Toast";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { criteriaOf, draftFor } from "~/lib/tracks";

interface Round {
  milestone: string;
  feedback: { text: string };
}

/**
 * Ready for OnStage (brief P38.7): per criterion of the model, in its order, the text the teacher
 * confirms, with Copy. The first version comes from the last final assessment; the teacher signs
 * in OnStage, never here.
 */
export function OnStagePanel({
  criteria,
  confirmed,
  rounds,
}: {
  criteria: string;
  confirmed: readonly { criterion: string; text: string }[];
  rounds: readonly Round[];
}) {
  const m = useT().tracks.onstage;
  const id = useId();
  const list = criteriaOf(criteria);
  const final = rounds.filter((r) => r.milestone === "final").at(-1)?.feedback.text ?? "";
  const saved = new Map(confirmed.map((c) => [c.criterion, c.text]));
  const [texts, setTexts] = useState(() => list.map((c) => saved.get(c) ?? draftFor(c, final)));
  const { showToast } = useToast();
  async function copy(i: number) {
    await navigator.clipboard?.writeText(texts[i] ?? "");
    showToast({ variant: "success", message: fmt(m.copied, { criterion: list[i] ?? "" }) });
  }
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-base font-medium text-slate-900">
        {m.heading}
      </h3>
      <Card className="mt-2 p-4">
        {list.length === 0 ? (
          <p className="max-w-[65ch] text-sm text-slate-700">{m.noCriteria}</p>
        ) : (
          <Form method="post" className="space-y-5">
            <input type="hidden" name="intent" value="onstage" />
            <p className="max-w-[65ch] text-sm font-medium text-slate-800">{m.intro}</p>
            {final && <p className="max-w-[65ch] text-sm text-slate-600">{m.draftNote}</p>}
            {list.map((c, i) => {
              const field = `${id}-c${i}`;
              const isConfirmed = saved.has(c) && saved.get(c) === texts[i];
              return (
                <div key={c}>
                  <input type="hidden" name="criterion" value={c} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor={field}>{c}</Label>
                    <div className="flex items-center gap-2">
                      {isConfirmed && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                          <CheckCircle2 className="size-4" aria-hidden />
                          {m.confirmed}
                        </span>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={fmt(m.copyFor, { criterion: c })}
                        onClick={() => copy(i)}
                      >
                        <Copy className="size-4" aria-hidden />
                        {m.copy}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id={field}
                    name="text"
                    rows={5}
                    className="mt-1"
                    value={texts[i] ?? ""}
                    onChange={(e) =>
                      setTexts((prev) => prev.map((t, j) => (j === i ? e.target.value : t)))
                    }
                  />
                </div>
              );
            })}
            <Button type="submit" size="sm">
              {m.confirm}
            </Button>
          </Form>
        )}
      </Card>
    </section>
  );
}
