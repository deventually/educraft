import type { Route } from "./+types/work.$generationId.export.$format";
import type { ExportDoc } from "~/lib/export/doc";
import { DOCX_TYPE, exportDocToDocx } from "~/lib/export/docx";
import { attachmentHeaders, safeFileName } from "~/lib/export/filename";
import { type ExportFormat, isExportFormat } from "~/lib/export/formats";
import { exportDocToMarkdown, MARKDOWN_TYPE } from "~/lib/export/md";
import { loadExport } from "~/server/export.server";

/** The file writers. PDF has none: it is made by the browser from the print page (P30.2). */
const WRITERS: Partial<
  Record<ExportFormat, { type: string; write: (doc: ExportDoc) => Promise<BodyInit> | BodyInit }>
> = {
  docx: { type: DOCX_TYPE, write: exportDocToDocx },
  md: { type: MARKDOWN_TYPE, write: exportDocToMarkdown },
};

/**
 * Resource route (no UI): GET /work/:generationId/export/:format → the result as a file
 * (brief P30.1). An unknown format, or one that does not fit the result, is a 404.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { format } = params;
  const writer = isExportFormat(format) ? WRITERS[format] : undefined;
  if (!writer) throw new Response("Not Found", { status: 404 });
  const { doc, formats, fileBase } = await loadExport(request, params.generationId);
  if (!formats.includes(format as ExportFormat)) throw new Response("Not Found", { status: 404 });
  const body = await writer.write(doc);
  return new Response(body, {
    headers: attachmentHeaders(safeFileName(fileBase, format, "export"), writer.type),
  });
}
