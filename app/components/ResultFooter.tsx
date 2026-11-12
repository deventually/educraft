import { AiNotice } from "./AiNotice";
import { WordDownload } from "./export/WordDownload";
import type { Locale } from "~/lib/i18n";
import { useT } from "~/lib/i18n/useT";

/**
 * Under a one-shot result: Word for a result that was not saved (P38.6; saved work has the export
 * menu), the note that names came back, and the AI-transparency notice (the "teacher decides"
 * variant for grading tools, from registry data).
 */
export function ResultFooter({
  markdown,
  done,
  saved,
  restored,
  title,
  lang,
  assistive,
}: {
  markdown: string;
  /** A finished result the teacher is not reviewing. */
  done: boolean;
  saved: boolean;
  /** Names were put back in the browser. */
  restored: boolean;
  title: string;
  lang: Locale;
  assistive: boolean;
}) {
  const t = useT();
  return (
    <>
      {done && markdown && !saved && <WordDownload markdown={markdown} title={title} lang={lang} />}
      {restored && <p className="shrink-0 text-xs text-slate-600">{t.privacy.restoredNote}</p>}
      <AiNotice variant={assistive ? "assistive" : "generic"} className="shrink-0" />
    </>
  );
}
