import { useEffect } from "react";
import { Printer } from "lucide-react";
import type { ExportDoc } from "~/lib/export/doc";
import { Button } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { ExportPreview } from "./ExportPreview";

/**
 * A document as a printable page (brief P30.2). No PDF library: the page opens the browser's
 * print window and "Save as PDF" does the rest, with searchable text and the right fonts.
 */
export function PrintView({ doc }: { doc: ExportDoc }) {
  const m = useT().exportResult;

  useEffect(() => {
    window.print();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:p-0">
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 print:hidden">
          <Button type="button" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            {m.print}
          </Button>
          <p className="text-sm text-slate-600">{m.printHint}</p>
        </div>
        <ExportPreview
          doc={doc}
          level={1}
          className="export-doc space-y-4 text-base text-slate-900"
        />
      </main>
    </div>
  );
}
