import { useEffect, useId, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { DOC_ACCEPT_ATTR, filesToDocumentText } from "~/lib/documents/extract";
import { IMPORT_DOCUMENT_MAX, type ImportProposal } from "~/lib/courses/import";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import { Button, Card, HelpText, Input, Label, Textarea } from "~/components/ui";
import { FileInput } from "~/components/FileInput";
import { useT } from "~/lib/i18n/useT";
import { AiCallField } from "~/components/AiLeaveGuard";
import { AiNotes, ProposalForm } from "./ProposalForm";

type ImportAction = { ok: boolean; intent?: string; proposal?: ImportProposal } | undefined;
const PROPOSING = ["import-extract", "design-outcomes", "design-assessments"];

/**
 * The proposal of the last `import-extract`, kept across a failed apply (the
 * teacher's choice is not lost) and cleared after a successful `import-apply`.
 */
export function useImportProposal(actionData: ImportAction): ImportProposal | null {
  const [proposal, setProposal] = useState<ImportProposal | null>(null);
  useEffect(() => {
    if (!actionData?.ok) return;
    // A design proposal (`design-outcomes`, `design-assessments`) is reviewed the same way.
    if (PROPOSING.includes(actionData.intent ?? "") && actionData.proposal)
      setProposal(actionData.proposal);
    if (actionData.intent === "import-apply") setProposal(null);
  }, [actionData]);
  return proposal;
}

/**
 * "Import from a course catalogue or study guide" (brief P26, 26.3). The file
 * is read in the browser (`fileToText`); only its text is posted (intent
 * `import-extract`). The answer is a proposal the teacher ticks and edits;
 * `import-apply` adds what is ticked. Works without JS by pasting.
 */
export function CourseImport({
  courseName,
  startOpen,
  proposal,
  notes,
}: {
  courseName: string;
  startOpen: boolean;
  proposal: ImportProposal | null;
  /** The AI's explanation when the last `import-extract` found nothing to import. */
  notes?: string;
}) {
  const ti = useT().courses.import;
  const nav = useNavigation();
  const busy = nav.state === "submitting" && nav.formData?.get("intent") === "import-extract";
  const [value, setValue] = useState("");
  const [failed, setFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = useId();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    if (!files.length) return;
    try {
      // Several files (a test blueprint and a marking model) become one text, each under its name.
      setValue((await filesToDocumentText(files)).text.trim().slice(0, IMPORT_DOCUMENT_MAX));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section id="course-import" aria-labelledby={`${id}-title`}>
      <Card className="p-4">
        <details open={startOpen || !!proposal || !!notes}>
          <summary className="cursor-pointer text-lg font-medium text-slate-900">
            <span id={`${id}-title`}>{ti.title}</span>
          </summary>
          <p className="mt-2 text-sm text-slate-600">{ti.body}</p>
          <Form method="post" className="mt-4 grid gap-3">
            <input type="hidden" name="intent" value="import-extract" />
            <AiCallField />
            <div>
              <Label htmlFor={`${id}-text`}>{ti.text}</Label>
              <Textarea
                id={`${id}-text`}
                name="documentText"
                rows={6}
                required
                value={value}
                maxLength={IMPORT_DOCUMENT_MAX}
                onChange={(e) => setValue(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`${id}-file`}>{ti.file}</Label>
              <FileInput
                ref={fileRef}
                id={`${id}-file`}
                accept={DOC_ACCEPT_ATTR}
                multiple
                aria-describedby={`${id}-file-help`}
                onChange={onFile}
                className="mt-1"
              />
              <HelpText id={`${id}-file-help`}>{failed ? ti.fileFailed : ti.fileHelp}</HelpText>
            </div>
            <div>
              <Label htmlFor={`${id}-name`}>{ti.courseName}</Label>
              <Input
                id={`${id}-name`}
                name="courseName"
                defaultValue={courseName}
                maxLength={COURSE_LIMITS.title}
                aria-describedby={`${id}-name-help`}
                className="mt-1"
              />
              <HelpText id={`${id}-name-help`}>{ti.courseNameHint}</HelpText>
            </div>
            <div>
              <Button type="submit" disabled={busy}>
                {ti.extract}
              </Button>
            </div>
          </Form>
          {notes && !proposal && <AiNotes notes={notes} />}
          {proposal && <ProposalForm proposal={proposal} />}
        </details>
      </Card>
    </section>
  );
}
