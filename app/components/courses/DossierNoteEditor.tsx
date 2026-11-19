import { useId, useRef, useState } from "react";
import { Form } from "react-router";
import { Sparkles } from "lucide-react";
import { SendRound } from "~/components/privacy/SendRound";
import { Button, Card, HelpText, Label, Select, Textarea } from "~/components/ui";
import { useSendRound } from "~/lib/hooks/useSendRound";
import { DOSSIER_NOTE_LIMITS, type DossierNote } from "~/lib/courses/dossierNote";
import { fmt } from "~/lib/i18n/format";
import type { PrivacyPage } from "~/lib/privacy/live";
import { useT } from "~/lib/i18n/useT";

type Messages = ReturnType<typeof useT>["dossierNote"];

/** The AI's concept: marked as a concept, with the reflection questions, to take over and rewrite. */
function Concept({ note, onTake, m }: { note: DossierNote; onTake: () => void; m: Messages }) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"
    >
      <h2 id={id} className="text-base font-medium text-slate-900">
        {m.concept.heading}
      </h2>
      <p className="mt-1 text-amber-900">{m.concept.notice}</p>
      <div className="mt-3 space-y-2 text-slate-800">
        {note.draft.split("\n\n").map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      {note.questions.length > 0 && (
        <>
          <h3 className="mt-3 font-medium text-slate-900">{m.concept.questions}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-800">
            {note.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </>
      )}
      {note.dropped > 0 && (
        <p className="mt-3 text-xs text-slate-600">
          {note.dropped === 1
            ? m.concept.droppedOne
            : fmt(m.concept.droppedMany, { n: note.dropped })}
        </p>
      )}
      <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={onTake}>
        {m.concept.take}
      </Button>
    </section>
  );
}

/**
 * The teacher's own notes on the test analysis (brief P35.2). The text is theirs: a concept by the
 * AI only comes on request, after the overview of what goes (anonymiseerpoort step 4), stands
 * apart as a concept with one or two reflection questions, and only reaches the note when the
 * teacher takes it over to rewrite. The page's toast announces the concept and the save.
 */
export function DossierNoteEditor({
  analysis,
  note,
  draft,
  models,
  answer,
  privacy,
}: {
  /** The numbers of the caller's own linked analysis, or null when none is linked. */
  analysis: string | null;
  note: string;
  draft: DossierNote | null;
  models: { id: string; displayName: string }[];
  answer?: unknown;
  privacy?: PrivacyPage;
}) {
  const m = useT().dossierNote;
  const id = useId();
  const round = useSendRound(privacy, answer, "draft-note");
  const [text, setText] = useState(note);
  const field = useRef<HTMLTextAreaElement>(null);

  function ask(model: string) {
    const form = new FormData();
    form.set("intent", "draft-note");
    if (model) form.set("model", model);
    // The numbers are read on the server; the overview shows them, they are not posted.
    round.start(form, [{ name: "analysis", label: m.overview, text: analysis ?? "", held: true }]);
  }

  return (
    <div className="mt-6 max-w-3xl space-y-6">
      <p className="max-w-[65ch] text-sm text-slate-600">{m.intro}</p>
      <Card className="p-4">
        {analysis ? (
          <>
            <details>
              <summary className="cursor-pointer text-sm font-medium text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-500">
                {m.numbers}
              </summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-slate-700">
                {analysis}
              </pre>
            </details>
            <form
              className="mt-3 flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                ask(String(new FormData(e.currentTarget).get("model") ?? ""));
              }}
            >
              {models.length > 1 && (
                <div>
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
              <Button type="submit" size="sm" variant="secondary" aria-describedby={`${id}-ai`}>
                <Sparkles className="size-4" aria-hidden /> {m.draft}
              </Button>
            </form>
            <HelpText id={`${id}-ai`}>{m.draftHint}</HelpText>
            <SendRound round={round} />
          </>
        ) : (
          <p className="text-sm text-slate-700">{m.errors.noAnalysis}</p>
        )}
        {draft && (
          <Concept
            note={draft}
            m={m}
            onTake={() => {
              setText(draft.draft);
              field.current?.focus();
            }}
          />
        )}
      </Card>
      <Form method="post" className="space-y-3">
        <input type="hidden" name="intent" value="save-note" />
        <div>
          <Label htmlFor={`${id}-note`}>{m.field}</Label>
          <Textarea
            ref={field}
            id={`${id}-note`}
            name="note"
            rows={10}
            maxLength={DOSSIER_NOTE_LIMITS.note}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-describedby={`${id}-note-hint`}
            className="mt-1"
          />
          <HelpText id={`${id}-note-hint`}>{m.fieldHint}</HelpText>
        </div>
        <Button type="submit" size="sm">
          {m.save}
        </Button>
      </Form>
    </div>
  );
}
