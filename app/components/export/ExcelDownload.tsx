import { useRef } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "~/components/ui";
import { useToast } from "~/components/Toast";
import { safeFileName } from "~/lib/export/filename";
import type { Sheet } from "~/lib/export/xlsx";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

/**
 * "Download als Excel" for the tools without AI (brief P30.3). The workbook is made here, in the
 * browser, so a score list or a grade table never goes to the server. The Excel writer is loaded
 * only on the first click, so the page itself stays light.
 */
export function ExcelDownload({
  fileName,
  title,
  sheets,
}: {
  /** Without extension. */
  fileName: string;
  /** Goes in the file's properties. */
  title: string;
  /** Read at the moment of the click, so the file has what the screen shows then. */
  sheets: () => Sheet[];
}) {
  const m = useT().exportResult;
  const { showToast } = useToast();
  const busy = useRef(false);

  async function onClick() {
    if (busy.current) return;
    busy.current = true;
    try {
      const { writeXlsx, XLSX_TYPE } = await import("~/lib/export/xlsx");
      const bytes = await writeXlsx(sheets(), title);
      const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_TYPE }));
      const link = document.createElement("a");
      link.href = url;
      link.download = safeFileName(fileName, "xlsx", "export");
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      showToast({ variant: "error", message: m.excelFailed });
    } finally {
      busy.current = false;
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={onClick}>
      <FileSpreadsheet className="size-4" aria-hidden />
      {fmt(m.download, { format: m.formats.xlsx })}
    </Button>
  );
}
