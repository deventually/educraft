import { useId, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { DOC_ACCEPT_ATTR, fileToText } from "~/lib/documents/extract";
import { LIMITS } from "~/lib/portfolio/schema";
import { Button, Card, HelpText, Label, Textarea } from "~/components/ui";
import { FileInput } from "~/components/FileInput";
import { useT } from "~/lib/i18n/useT";
import { AiCallField } from "~/components/AiLeaveGuard";

/**
 * "Extract the framework from your form" (brief P25, 25.4). The teacher pastes
 * the form text or picks the PDF/Word file; the file is read in the browser
 * (`fileToText`) and only its text is posted (intent `extract`). Works without
 * JS by pasting.
 */
export function FrameworkExtract({ replaces }: { replaces: boolean }) {
  const tf = useT().portfolio.framework;
  const nav = useNavigation();
  const busy = nav.state === "submitting" && nav.formData?.get("intent") === "extract";
  const [value, setValue] = useState("");
  const [failed, setFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const helpId = `${id}-help`;

  // Several files at once (an institution may publish one PDF per learning
  // outcome); each file's text is appended, so pasted text is kept.
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    try {
      const texts: string[] = [];
      for (const file of files) texts.push((await fileToText(file)).text.trim());
      setValue((prev) =>
        [prev.trim(), ...texts].filter(Boolean).join("\n\n").slice(0, LIMITS.documentText),
      );
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card className="mt-6 p-5">
      <h2 className="text-lg font-medium text-slate-900">{tf.extractTitle}</h2>
      <p className="mt-1 text-sm text-slate-600">{tf.extractBody}</p>
      <Form method="post" className="mt-4 grid gap-3">
        <input type="hidden" name="intent" value="extract" />
        <AiCallField />
        <div>
          <Label htmlFor={`${id}-text`}>{tf.extractText}</Label>
          <Textarea
            id={`${id}-text`}
            name="formText"
            rows={8}
            required
            value={value}
            maxLength={LIMITS.documentText}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`${id}-file`}>{tf.extractFile}</Label>
          <FileInput
            ref={fileRef}
            id={`${id}-file`}
            multiple
            accept={DOC_ACCEPT_ATTR}
            aria-describedby={helpId}
            onChange={onFile}
            className="mt-1"
          />
          <HelpText id={helpId}>{failed ? tf.extractFileFailed : tf.extractFileHelp}</HelpText>
        </div>
        {replaces && <p className="text-sm text-amber-800">{tf.extractReplace}</p>}
        <div>
          <Button type="submit" disabled={busy}>
            {tf.extract}
          </Button>
        </div>
      </Form>
    </Card>
  );
}
