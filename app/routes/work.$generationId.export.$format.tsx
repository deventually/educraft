import type { Route } from "./+types/work.$generationId.export.$format";
import { DOCX_TYPE, exportDocToDocx } from "~/lib/export/docx";
import { attachmentHeaders, safeFileName } from "~/lib/export/filename";
import { isExportFormat } from "~/lib/export/formats";
import { loadExport } from "~/server/export.server";

/**
 * Resource route (no UI): GET /work/:generationId/export/:format → the result as a file
 * (brief P30.1). An unknown format, or one that does not fit the result, is a 404.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { format } = params;
  if (!isExportFormat(format)) throw new Response("Not Found", { status: 404 });
  const { doc, formats, fileBase } = await loadExport(request, params.generationId);
  if (!formats.includes(format)) throw new Response("Not Found", { status: 404 });
  const bytes = await exportDocToDocx(doc);
  return new Response(bytes, {
    headers: attachmentHeaders(safeFileName(fileBase, format, "export"), DOCX_TYPE),
  });
}
