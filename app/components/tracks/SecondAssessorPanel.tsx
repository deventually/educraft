import { useId, useState } from "react";
import { Form, Link } from "react-router";
import { Button, Card, Label, Select } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

interface RubricChoice {
  id: string;
  name: string;
  criteria: { id: string; title: string; levels: { id: string; label: string }[] }[];
}

/**
 * The second assessor (brief P38.5): per criterion of one of the teacher's rubrics, their level
 * and the colleague's. The server compares them (P34.1) and keeps only the outcome as a round;
 * the page's toast announces it.
 */
export function SecondAssessorPanel({
  rubrics,
  rubricsOn,
}: {
  rubrics: RubricChoice[];
  /** Whether Hulpmiddelen (where the rubrics live) is on for this teacher. */
  rubricsOn: boolean;
}) {
  const m = useT().tracks.secondAssessor;
  const id = useId();
  const [rubricId, setRubricId] = useState(rubrics[0]?.id ?? "");
  const rubric = rubrics.find((r) => r.id === rubricId);
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-base font-medium text-slate-900">
        {m.heading}
      </h3>
      <Card className="mt-2 p-4">
        <p className="max-w-[65ch] text-sm text-slate-600">{m.intro}</p>
        {!rubric && !rubricsOn ? (
          <p className="mt-3 text-sm text-slate-700">{m.rubricsOff}</p>
        ) : !rubric ? (
          <p className="mt-3 text-sm text-slate-700">
            {m.noRubrics}{" "}
            <Link to="/utilities/rubric" className="font-medium text-violet-700 underline">
              {m.rubricsLink}
            </Link>
          </p>
        ) : (
          <>
            {rubrics.length > 1 && (
              <div className="mt-4 max-w-sm">
                <Label htmlFor={`${id}-rubric`}>{m.rubric}</Label>
                <Select
                  id={`${id}-rubric`}
                  value={rubricId}
                  onChange={(e) => setRubricId(e.target.value)}
                  className="mt-1"
                >
                  {rubrics.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <Form method="post" className="mt-4 space-y-4" key={rubric.id}>
              <input type="hidden" name="intent" value="second-assessor" />
              <input type="hidden" name="rubricId" value={rubric.id} />
              {rubric.criteria.map((c) => (
                <fieldset key={c.id} className="rounded-xl border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-medium text-slate-800">{c.title}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["a", "b"] as const).map((side) => (
                      <div key={side}>
                        <Label htmlFor={`${id}-${side}-${c.id}`}>
                          {side === "a" ? m.mine : m.theirs}
                        </Label>
                        <Select
                          id={`${id}-${side}-${c.id}`}
                          name={`${side}:${c.id}`}
                          required
                          defaultValue=""
                          className="mt-1"
                        >
                          <option value="" disabled>
                            {m.pick}
                          </option>
                          {c.levels.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ))}
                  </div>
                </fieldset>
              ))}
              <Button type="submit" size="sm">
                {m.submit}
              </Button>
            </Form>
          </>
        )}
      </Card>
    </section>
  );
}
