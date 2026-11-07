import { useEffect, useId, useState } from "react";
import { Form, useActionData } from "react-router";
import { FileInput } from "~/components/FileInput";
import { Button, Label } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { outcomeLabel } from "~/lib/portfolio/format";
import { wordCount } from "~/lib/portfolio/progress";
import type { DossierData } from "~/lib/portfolio/types";
import { type ReadBack, readBack } from "~/lib/portfolio/wordImport";

interface Props {
  outcomes: DossierData["framework"]["outcomes"];
  chapters: Pick<DossierData["chapters"][number], "outcomeId" | "text">[];
  references: DossierData["references"];
}

type State =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "unreadable" }
  | { kind: "read"; result: ReadBack };

/**
 * Back from Word: the teacher brings an edited export back. The file is read in
 * the browser; per chapter they see what differs and tick what to take over.
 * Nothing is saved without that tick (`importChapters`).
 */
export function WordImport({ outcomes, chapters, references }: Props) {
  const t = useT().portfolio.fromWord;
  const fileId = useId();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [fileKey, setFileKey] = useState(0);
  const actionData = useActionData<{ ok?: boolean } | undefined>();

  // After a successful save, start over: the overview now shows the new text.
  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok) {
      setState({ kind: "idle" });
      setTaken(new Set());
      setSources(new Set());
      setFileKey((k) => k + 1);
    }
  }, [actionData]);

  async function read(file: File | undefined) {
    setTaken(new Set());
    setSources(new Set());
    if (!file) return setState({ kind: "idle" });
    setState({ kind: "reading" });
    try {
      const { docxToSafeNodes } = await import("~/lib/documents/docxHtml");
      const nodes = await docxToSafeNodes(new Uint8Array(await file.arrayBuffer()));
      setState({
        kind: "read",
        result: readBack(nodes, { framework: { outcomes }, chapters, references }),
      });
    } catch {
      setState({ kind: "unreadable" });
    }
  }

  const toggle = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };
  const labelOf = (outcomeId: string) => {
    const o = outcomes.find((x) => x.id === outcomeId);
    return o ? outcomeLabel(o) : "";
  };
  const textNow = (outcomeId: string) =>
    chapters.find((c) => c.outcomeId === outcomeId)?.text ?? "";

  const result = state.kind === "read" ? state.result : null;
  const chosen = result?.chapters.filter((c) => c.changed && taken.has(c.outcomeId)) ?? [];

  return (
    <section className="mt-8" aria-labelledby="from-word-title">
      <h2 id="from-word-title" className="text-lg font-medium text-slate-900">
        {t.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t.intro}</p>
      <div className="mt-3">
        <Label htmlFor={fileId}>{t.file}</Label>
        <FileInput
          key={fileKey}
          id={fileId}
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="mt-1"
          onChange={(e) => read(e.currentTarget.files?.[0])}
        />
      </div>

      <div aria-live="polite" className="mt-3 text-sm text-slate-800">
        {state.kind === "reading" && <p>{t.reading}</p>}
        {state.kind === "unreadable" && <p>{t.unreadable}</p>}
        {result && !result.chapters.length && (
          <p>{fmt(t.noneFound, { example: outcomes[0] ? outcomeLabel(outcomes[0]) : "LU1" })}</p>
        )}
      </div>

      {result && result.chapters.length > 0 && (
        <Form method="post" className="mt-3 space-y-4">
          <input type="hidden" name="intent" value="importChapters" />
          <input
            type="hidden"
            name="chapters"
            value={JSON.stringify(chosen.map(({ outcomeId, text }) => ({ outcomeId, text })))}
          />
          <fieldset>
            <legend className="text-sm font-medium text-slate-900">{t.chaptersLegend}</legend>
            <ul className="mt-2 space-y-3">
              {result.chapters.map((c) => (
                <li key={c.outcomeId} className="text-sm text-slate-700">
                  {c.changed ? (
                    <>
                      <label className="flex items-center gap-2 font-medium text-slate-900">
                        <input
                          type="checkbox"
                          checked={taken.has(c.outcomeId)}
                          onChange={() => setTaken((s) => toggle(s, c.outcomeId))}
                        />
                        {fmt(t.take, { outcome: labelOf(c.outcomeId) })}
                      </label>
                      <p className="ml-6">
                        {fmt(t.changed, {
                          now: wordCount(textNow(c.outcomeId)),
                          word: wordCount(c.text),
                        })}
                      </p>
                      <details className="ml-6">
                        <summary className="cursor-pointer text-violet-700">{t.preview}</summary>
                        <p className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2">{c.text}</p>
                      </details>
                    </>
                  ) : (
                    <p>{fmt(t.unchanged, { outcome: labelOf(c.outcomeId) })}</p>
                  )}
                </li>
              ))}
            </ul>
          </fieldset>
          {result.references.length > 0 && (
            <fieldset>
              <legend className="text-sm font-medium text-slate-900">{t.referencesLegend}</legend>
              <ul className="mt-2 space-y-1">
                {result.references.map((r) => (
                  <li key={r}>
                    <label className="flex items-start gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="reference"
                        value={r}
                        checked={sources.has(r)}
                        onChange={() => setSources((s) => toggle(s, r))}
                        className="mt-1"
                      />
                      {r}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          {result.unknownHeadings.length > 0 && (
            <p className="text-sm text-slate-700">
              {fmt(t.unknown, { headings: result.unknownHeadings.map((h) => `"${h}"`).join(", ") })}
            </p>
          )}
          <Button type="submit" size="sm" disabled={!chosen.length && !sources.size}>
            {t.submit}
          </Button>
        </Form>
      )}
    </section>
  );
}
