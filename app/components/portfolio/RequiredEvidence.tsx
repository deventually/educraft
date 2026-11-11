import { Form } from "react-router";
import { AlertTriangle, CircleCheck, CircleX } from "lucide-react";
import { Button, Label, Select } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import type { RequirementState } from "~/lib/portfolio/requirements";

type State = "done" | "guess" | "missing";

const ICON: Record<State, { Icon: typeof CircleCheck; className: string }> = {
  done: { Icon: CircleCheck, className: "text-emerald-700" },
  guess: { Icon: AlertTriangle, className: "text-amber-700" },
  missing: { Icon: CircleX, className: "text-red-700" },
};

const state = (r: RequirementState): State =>
  r.linked.length > 0 ? "done" : r.guess ? "guess" : "missing";

/** One `linkRequirement` form: the line and the outcome, plus the item and on/off. */
function LinkForm({
  outcomeId,
  line,
  linked,
  children,
  className,
}: {
  outcomeId: string;
  line: string;
  linked: "on" | "off";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Form method="post" className={className}>
      <input type="hidden" name="intent" value="linkRequirement" />
      <input type="hidden" name="outcomeId" value={outcomeId} />
      <input type="hidden" name="line" value={line} />
      <input type="hidden" name="linked" value={linked} />
      {children}
    </Form>
  );
}

/**
 * On the evidence tab: what the form asks for as evidence, as a checklist (stap 3). A line is
 * done when the teacher ticked an item for it; an item of a matching kind is only a guess to
 * confirm. Every state has an icon and a word, never colour alone.
 */
export function RequiredEvidence({
  outcomeId,
  items,
  evidence,
}: {
  outcomeId: string;
  items: RequirementState[];
  evidence: { id: string; title: string }[];
}) {
  const tr = useT().portfolioRoute.required;
  if (items.length === 0) return null;
  return (
    <section className="mt-6" aria-labelledby="required-title">
      <h2 id="required-title" className="text-lg font-medium text-slate-900">
        {tr.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{tr.intro}</p>
      <ul aria-labelledby="required-title" className="mt-3 space-y-2">
        {items.map((r, i) => {
          const s = state(r);
          const { Icon, className } = ICON[s];
          return (
            <li
              key={r.line}
              className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-slate-800">
                  <span className="font-medium text-slate-900">{tr.level[s]}: </span>
                  {r.line}
                </p>
                {r.linked.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600">
                    <span>
                      {fmt(tr.linked, { titles: r.linked.map((e) => e.title).join(", ") })}
                    </span>
                    {r.linked.map((e) => (
                      <LinkForm key={e.id} outcomeId={outcomeId} line={r.line} linked="off">
                        <input type="hidden" name="evidenceId" value={e.id} />
                        <Button
                          type="submit"
                          variant="secondary"
                          size="sm"
                          aria-label={fmt(tr.unlinkLabel, { title: e.title })}
                        >
                          {tr.unlink}
                        </Button>
                      </LinkForm>
                    ))}
                  </div>
                )}
                {r.guess && (
                  <LinkForm
                    outcomeId={outcomeId}
                    line={r.line}
                    linked="on"
                    className="mt-1 flex flex-wrap items-center gap-2 text-slate-600"
                  >
                    <span>{fmt(tr.found, { title: r.guess.title })}</span>
                    <input type="hidden" name="evidenceId" value={r.guess.id} />
                    <Button type="submit" variant="secondary" size="sm">
                      {tr.confirm}
                    </Button>
                  </LinkForm>
                )}
                {s !== "done" && (
                  <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
                    {evidence.length > 0 && (
                      <LinkForm
                        outcomeId={outcomeId}
                        line={r.line}
                        linked="on"
                        className="flex flex-wrap items-end gap-2"
                      >
                        <div>
                          <Label htmlFor={`required-${i}`}>{tr.choose}</Label>
                          <Select id={`required-${i}`} name="evidenceId">
                            {evidence.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.title}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <Button type="submit" variant="secondary" size="sm">
                          {tr.link}
                        </Button>
                      </LinkForm>
                    )}
                    <a
                      href="#add-evidence-title"
                      className="font-medium text-violet-700 underline underline-offset-2"
                    >
                      {tr.add}
                    </a>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
