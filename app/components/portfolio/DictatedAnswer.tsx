import { useRef } from "react";
import { DictateButton } from "~/components/DictateButton";
import { Label, Textarea } from "~/components/ui";
import { appendDictation } from "~/lib/speech/dictation";
import { useLocale } from "~/lib/i18n/useT";

/**
 * One answer of guided writing, with dictation beside its question. The field stays
 * uncontrolled (the chapter's form posts it); dictated text lands after what is there,
 * and nothing is saved until the teacher has read it back and pressed a button.
 */
export function DictatedAnswer({
  id,
  question,
  name,
  defaultValue,
  describedBy,
}: {
  id: string;
  question: string;
  name: string;
  defaultValue: string;
  describedBy: string;
}) {
  const locale = useLocale();
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{question}</Label>
        <DictateButton
          lang={locale}
          field={question}
          onText={(text) => {
            const el = ref.current;
            if (el) el.value = appendDictation(el.value, text);
          }}
        />
      </div>
      <Textarea
        ref={ref}
        id={id}
        name={name}
        rows={3}
        defaultValue={defaultValue}
        aria-describedby={describedBy}
      />
    </div>
  );
}
