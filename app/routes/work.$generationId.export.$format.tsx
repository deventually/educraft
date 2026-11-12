import type { Route } from "./+types/work.$generationId.export.$format";
import { attachmentHeaders, safeFileName } from "~/lib/export/filename";
import type { ExportFormat } from "~/lib/export/formats";
import { fileWriter } from "~/lib/export/writers";
import { chosenTemplate, loadExport } from "~/server/export.server";

/**
 * Resource route (no UI): GET /work/:generationId/export/:format → the result as a file
 * (brief P30.1). An unknown format, or one that does not fit the result, is a 404.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { format } = params;
  const writer = fileWriter(format);
  if (!writer) throw new Response("Not Found", { status: 404 });
  const { doc, formats, fileBase } = await loadExport(request, params.generationId);
  if (!formats.includes(format as ExportFormat)) throw new Response("Not Found", { status: 404 });
  const body = await writer.write(doc, { template: await chosenTemplate(request) });
  return new Response(body, {
    headers: attachmentHeaders(safeFileName(fileBase, format, "export"), writer.type),
  });
}
