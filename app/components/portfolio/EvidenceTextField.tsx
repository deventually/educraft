import { useId, useRef, useState } from "react";
import { DOC_ACCEPT_ATTR, fileToText } from "~/lib/documents/extract";
import { LIMITS } from "~/lib/portfolio/schema";
import { HelpText, Label, Textarea } from "~/components/ui";
import { FileInput } from "~/components/FileInput";
import { DictateButton } from "~/components/DictateButton";
import { appendDictation } from "~/lib/speech/dictation";
import { useLocale, useT } from "~/lib/i18n/useT";

/**
 * The evidence text: paste it, or take it from a PDF/Word file. Extraction runs
 * in the browser (`fileToText`); the file itself is never sent or stored. Or dictate it:
 * the text lands in the field for the teacher to read back before saving.
 */
export function EvidenceTextField({
  id,
  defaultValue = "",
}: {
  id: string;
  defaultValue?: string;
}) {
  const t = useT().portfolio.outcome;
  const locale = useLocale();
  const [value, setValue] = useState(defaultValue);
  const [failed, setFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const helpId = useId();
  const textHelpId = useId();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { text } = await fileToText(file);
      setValue(text.slice(0, LIMITS.documentText));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={id}>{t.evidenceText}</Label>
          <DictateButton
            lang={locale}
            field={t.evidenceText}
            onText={(text) =>
              setValue((v) => appendDictation(v, text).slice(0, LIMITS.documentText))
            }
          />
        </div>
        <Textarea
          id={id}
          name="text"
          rows={5}
          value={value}
          maxLength={LIMITS.documentText}
          aria-describedby={textHelpId}
          onChange={(e) => setValue(e.target.value)}
        />
        <HelpText id={textHelpId}>{t.evidenceTextHelp}</HelpText>
      </div>
      <div>
        <Label htmlFor={`${id}-file`}>{t.evidenceUpload}</Label>
        <FileInput
          ref={fileRef}
          id={`${id}-file`}
          accept={DOC_ACCEPT_ATTR}
          aria-describedby={helpId}
          onChange={onFile}
          className="mt-1"
        />
        <HelpText id={helpId}>{failed ? t.evidenceUploadFailed : t.evidenceUploadHelp}</HelpText>
      </div>
    </div>
  );
}
