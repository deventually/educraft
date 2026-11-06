import { useId, useState, type FormEvent } from "react";
import { useFetcher } from "react-router";
import { MessageSquareHeart } from "lucide-react";
import { Button, Label, Textarea } from "~/components/ui";
import { useActionToast } from "~/components/Toast";
import { useT } from "~/lib/i18n/useT";
import { CHECKIN_ANSWER_MAX, CHECKIN_QUESTIONS, type CheckinQuestion } from "~/lib/pilot";

type Answers = Record<CheckinQuestion, string>;
const EMPTY: Answers = { helped: "", annoyed: "", missing: "" };

/**
 * The periodic pilot check-in on Start (the start loader decides when it is due): three short,
 * optional questions. "Not now" closes it and is remembered, so it stays away for a
 * while. Posts JSON to `/api/checkin`; thanks go through the toast system.
 */
export function PilotCheckin() {
  const t = useT();
  const m = t.pilot.checkin;
  const headingId = useId();
  const baseId = useId();
  const fetcher = useFetcher<{ ok: boolean }>();
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  // "dismissed" closes at once; "answered" closes once the server took the answers.
  const [closed, setClosed] = useState<"open" | "dismissed" | "answered">("open");
  const answered = Object.values(answers).some((a) => a.trim());

  useActionToast(fetcher.data, (d) =>
    d.ok && closed === "answered" ? { variant: "success", message: m.thanks } : null,
  );

  if (closed === "dismissed" || (closed === "answered" && fetcher.data?.ok)) return null;

  function submit(body: Record<string, string>) {
    void fetcher.submit(body, {
      method: "post",
      action: "/api/checkin",
      encType: "application/json",
    });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!answered) return;
    setClosed("answered");
    submit({ intent: "answer", ...answers });
  }

  function notNow() {
    setClosed("dismissed");
    submit({ intent: "dismiss" });
  }

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-lime-200 bg-lime-50/60 p-4 shadow-sm sm:p-5"
    >
      <h2
        id={headingId}
        className="flex items-center gap-2 font-display text-base font-medium text-slate-900"
      >
        <MessageSquareHeart className="size-5 text-lime-700" aria-hidden />
        {m.heading}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{m.intro}</p>
      <form onSubmit={onSubmit} className="mt-3 space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          {CHECKIN_QUESTIONS.map((q) => (
            <div key={q}>
              <Label htmlFor={`${baseId}-${q}`}>{m.questions[q]}</Label>
              <Textarea
                id={`${baseId}-${q}`}
                name={q}
                rows={2}
                maxLength={CHECKIN_ANSWER_MAX}
                value={answers[q]}
                onChange={(e) => setAnswers((a) => ({ ...a, [q]: e.target.value }))}
                className="mt-1"
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={!answered || fetcher.state !== "idle"}>
            {m.submit}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={notNow}>
            {m.notNow}
          </Button>
        </div>
      </form>
    </section>
  );
}
