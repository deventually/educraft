import { useEffect, useId, useRef, useState } from "react";
import { Form } from "react-router";
import { ShieldCheck } from "lucide-react";
import {
  emptyRedactDraft,
  RedactReview,
  type RedactDraft,
} from "~/components/privacy/RedactReview";
import { AiCallField } from "~/components/AiLeaveGuard";
import { Button, Card, HelpText, Label, Select, Textarea } from "~/components/ui";
import { FEEDFORWARD_LIMITS } from "~/lib/tracks/feedforward";
import { useT } from "~/lib/i18n/useT";

const FOCUSABLE = 'textarea, select, button, input:not([type="hidden"]), [tabindex="0"]';

/**
 * Feedforward on a new version (brief P38.3): the text is pasted, goes through the name check
 * (`RedactReview`) in the browser, and only then is sent with the criteria. The result lands as
 * a round of the milestone; the page's toast announces it.
 */
export function FeedforwardPanel({
  criteria: initialCriteria,
  models = [],
}: {
  /** The linked assessment model's framework; "" when none is linked. */
  criteria: string;
  /** The models the teacher may choose; a choice is offered with more than one. */
  models?: { id: string; displayName: string }[];
}) {
  const m = useT().tracks.feedforward;
  const id = useId();
  const [text, setText] = useState("");
  const [criteria, setCriteria] = useState(initialCriteria);
  const [step, setStep] = useState<"input" | "check" | "ready">("input");
  const [draft, setDraft] = useState<RedactDraft>(emptyRedactDraft);
  const [redacted, setRedacted] = useState("");
  // A step replaces the button that led to it: move focus to the new step's first control.
  const stepRef = useRef<HTMLDivElement>(null);
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    stepRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [step]);

  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-base font-medium text-slate-900">
        {m.heading}
      </h3>
      <Card className="mt-2 p-4">
        <p className="max-w-[65ch] text-sm text-slate-600">{m.intro}</p>
        <div ref={stepRef}>
          {step === "input" && (
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setStep("check");
              }}
            >
              <div>
                <Label htmlFor={`${id}-version`}>{m.version}</Label>
                <Textarea
                  id={`${id}-version`}
                  rows={8}
                  required
                  maxLength={FEEDFORWARD_LIMITS.version}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  aria-describedby={`${id}-version-hint`}
                  className="mt-1"
                />
                <HelpText id={`${id}-version-hint`}>{m.versionHint}</HelpText>
              </div>
              <Button type="submit" size="sm" variant="secondary">
                <ShieldCheck className="size-4" aria-hidden /> {m.check}
              </Button>
            </form>
          )}
          {step === "check" && (
            <div className="mt-4">
              <RedactReview
                fields={[{ name: "version", label: m.version, text }]}
                draft={draft}
                onDraft={setDraft}
                onConfirm={(r) => {
                  setRedacted(r.values.version ?? "");
                  setStep("ready");
                }}
                onCancel={() => setStep("input")}
              />
            </div>
          )}
          {step === "ready" && (
            <Form method="post" className="mt-4 space-y-3">
              <p className="flex items-center gap-2 text-sm text-slate-700">
                <ShieldCheck className="size-4 text-violet-700" aria-hidden /> {m.checked}
              </p>
              <input type="hidden" name="intent" value="feedforward" />
              <AiCallField />
              <input type="hidden" name="version" value={redacted} />
              <div>
                <Label htmlFor={`${id}-criteria`}>{m.criteria}</Label>
                <Textarea
                  id={`${id}-criteria`}
                  name="criteria"
                  rows={6}
                  required
                  maxLength={FEEDFORWARD_LIMITS.criteriaText}
                  value={criteria}
                  onChange={(e) => setCriteria(e.target.value)}
                  aria-describedby={`${id}-criteria-hint`}
                  className="mt-1"
                />
                <HelpText id={`${id}-criteria-hint`}>{m.criteriaHint}</HelpText>
              </div>
              {models.length > 1 && (
                <div className="max-w-xs">
                  <Label htmlFor={`${id}-model`}>{m.model}</Label>
                  <Select id={`${id}-model`} name="model" className="mt-1">
                    {models.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.displayName}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm">
                  {m.submit}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setStep("input")}
                >
                  {m.edit}
                </Button>
              </div>
            </Form>
          )}
        </div>
      </Card>
    </section>
  );
}
