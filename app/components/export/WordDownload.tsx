import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "~/components/ui";
import type { Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

/**
 * A result that is not saved (`Tool.storesConversation: false`, a visit report in P38.6) as a
 * Word file, made in the browser: the text is never sent anywhere for it. Saved work uses the
 * export menu instead.
 */
export function WordDownload({
  markdown,
  title,
  lang,
}: {
  markdown: string;
  title: string;
  lang: Locale;
}) {
  const m = useT().exportResult;
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      // Loaded on demand: the Word writer is large and most results never need it here.
      const [{ toExportDoc }, { DOCX_TYPE, exportDocToDocx }, { safeFileName }] = await Promise.all(
        [import("~/lib/export/doc"), import("~/lib/export/docx"), import("~/lib/export/filename")],
      );
      const bytes = await exportDocToDocx(
        toExportDoc({ title, locale: lang, sections: [{ heading: null, markdown }] }),
      );
      const url = URL.createObjectURL(new Blob([bytes], { type: DOCX_TYPE }));
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFileName(title, "docx", "limeonit");
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button type="button" size="sm" variant="secondary" onClick={download} disabled={busy}>
      <FileDown className="size-4" aria-hidden />
      {fmt(m.download, { format: "Word" })}
    </Button>
  );
}
