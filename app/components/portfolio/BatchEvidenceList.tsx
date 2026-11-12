import { useId, useState } from "react";
import { Form } from "react-router";
import { Badge, Button, Card, Input, Label, Select } from "~/components/ui";
import type { BatchItem, SortProposal } from "~/lib/portfolio/batch";
import { LIMITS } from "~/lib/portfolio/schema";
import { EVIDENCE_KINDS, type EvidenceKind, type Outcome } from "~/lib/portfolio/types";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

type OutcomeView = Pick<Outcome, "id" | "code" | "title" | "requiredEvidence"> & {
  criteria: { id: string; text: string }[];
};

/** A chosen file after the name check: `text` has codes instead of names. */
interface CheckedFile {
  key: string;
  name: string;
  text: string;
}

/** One row as the teacher leaves it. Nothing starts ticked. */
interface RowState {
  add: boolean;
  title: string;
  kind: EvidenceKind;
  outcomeId: string;
  criterionIds: string[];
  line: string;
}

function initial(sorted: SortProposal[]): Record<string, RowState> {
  return Object.fromEntries(
    sorted.map((p) => [
      p.key,
      {
        add: false,
        title: p.title,
        kind: p.kind,
        outcomeId: p.outcomeId ?? "",
        criterionIds: p.criterionIds,
        line: p.line ?? "",
      },
    ]),
  );
}

const label = (o: OutcomeView) => [o.code, o.title].filter(Boolean).join(" ");

/** The proposals in one list: the teacher corrects, ticks and adds them in one save. */
export function BatchEvidenceList({
  outcomes,
  files,
  sorted,
  room,
}: {
  outcomes: OutcomeView[];
  files: CheckedFile[];
  sorted: SortProposal[];
  room: number;
}) {
  const t = useT();
  const tb = t.portfolioBatch;
  const prefix = useId();
  const [from, setFrom] = useState(sorted);
  const [rows, setRows] = useState(() => initial(sorted));
  // A new proposal replaces the list (React's "adjust state when a prop changes").
  if (from !== sorted) {
    setFrom(sorted);
    setRows(initial(sorted));
  }

  const proposals = sorted.filter((p) => files.some((f) => f.key === p.key) && rows[p.key]);
  const update = (key: string, patch: Partial<RowState>) =>
    setRows((r) => ({ ...r, [key]: { ...(r[key] as RowState), ...patch } }));

  const items: BatchItem[] = proposals.flatMap((p) => {
    const r = rows[p.key];
    const file = files.find((f) => f.key === p.key);
    if (!r?.add || !file) return [];
    return [
      {
        title: r.title.trim() || file.name,
        kind: r.kind,
        text: file.text,
        ...(r.outcomeId ? { outcomeId: r.outcomeId } : {}),
        criterionIds: r.outcomeId ? r.criterionIds : [],
        ...(r.outcomeId && r.line ? { line: r.line } : {}),
      },
    ];
  });
  const tooMany = items.length > room;

  return (
    <section className="mt-8" aria-labelledby={`${prefix}-title`}>
      <h2 id={`${prefix}-title`} className="text-lg font-medium text-slate-900">
        {tb.listTitle}
      </h2>
      <p className="mt-1 text-sm text-slate-700">{tb.listHelp}</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => {
          for (const p of proposals) if (!p.check) update(p.key, { add: true });
        }}
      >
        {tb.tickSure}
      </Button>

      <ul className="mt-4 space-y-3">
        {proposals.map((p) => {
          const r = rows[p.key] as RowState;
          const file = files.find((f) => f.key === p.key);
          const outcome = outcomes.find((o) => o.id === r.outcomeId);
          const id = `${prefix}-${p.key}`;
          return (
            <li key={p.key}>
              <Card className="p-4">
                <fieldset className="grid gap-3">
                  <legend className="break-all font-medium text-slate-900">{file?.name}</legend>
                  <p className="text-sm text-slate-700">
                    <Badge
                      className={
                        p.check
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-emerald-200 bg-emerald-50 text-emerald-900"
                      }
                    >
                      {p.check ? tb.check : tb.proposal}
                    </Badge>
                    {p.reason && <span className="ml-2">{p.reason}</span>}
                  </p>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <input
                      type="checkbox"
                      checked={r.add}
                      onChange={(e) => update(p.key, { add: e.target.checked })}
                    />
                    {tb.add}
                  </label>
                  <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
                    <div>
                      <Label htmlFor={`${id}-title`}>{tb.titleLabel}</Label>
                      <Input
                        id={`${id}-title`}
                        value={r.title}
                        maxLength={LIMITS.title}
                        onChange={(e) => update(p.key, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${id}-kind`}>{tb.kind}</Label>
                      <Select
                        id={`${id}-kind`}
                        value={r.kind}
                        onChange={(e) => update(p.key, { kind: e.target.value as EvidenceKind })}
                      >
                        {EVIDENCE_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {t.portfolio.kinds[k]}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`${id}-outcome`}>{tb.outcome}</Label>
                    <Select
                      id={`${id}-outcome`}
                      value={r.outcomeId}
                      onChange={(e) =>
                        update(p.key, { outcomeId: e.target.value, criterionIds: [], line: "" })
                      }
                    >
                      <option value="">{tb.noOutcome}</option>
                      {outcomes.map((o) => (
                        <option key={o.id} value={o.id}>
                          {label(o)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {outcome && outcome.criteria.length > 0 && (
                    <fieldset>
                      <legend className="text-sm font-medium text-slate-700">{tb.criteria}</legend>
                      <div className="mt-1 space-y-1">
                        {outcome.criteria.map((c, i) => (
                          <label
                            key={c.id}
                            className="flex items-start gap-2 text-sm text-slate-700"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={r.criterionIds.includes(c.id)}
                              onChange={(e) =>
                                update(p.key, {
                                  criterionIds: e.target.checked
                                    ? [...r.criterionIds, c.id]
                                    : r.criterionIds.filter((x) => x !== c.id),
                                })
                              }
                            />
                            <span>
                              {i + 1}. {c.text}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  {outcome && outcome.requiredEvidence.length > 0 && (
                    <div>
                      <Label htmlFor={`${id}-line`}>{tb.line}</Label>
                      <Select
                        id={`${id}-line`}
                        value={r.line}
                        onChange={(e) => update(p.key, { line: e.target.value })}
                      >
                        <option value="">{tb.noLine}</option>
                        {outcome.requiredEvidence.map((line) => (
                          <option key={line} value={line}>
                            {line}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </fieldset>
              </Card>
            </li>
          );
        })}
      </ul>

      <Form method="post" className="mt-4">
        <input type="hidden" name="intent" value="addEvidenceBatch" />
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        {tooMany && (
          <p className="mb-2 text-sm text-slate-700">
            {room === 1 ? tb.roomOne : fmt(tb.room, { n: room })}
          </p>
        )}
        <Button type="submit" disabled={items.length === 0 || tooMany}>
          {items.length === 1 ? tb.addOne : fmt(tb.addMany, { n: items.length })}
        </Button>
      </Form>
    </section>
  );
}
