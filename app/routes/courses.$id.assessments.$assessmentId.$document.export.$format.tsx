import type { Route } from "./+types/courses.$id.assessments.$assessmentId.$document.export.$format";
import { attachmentHeaders, safeFileName } from "~/lib/export/filename";
import type { ExportFormat } from "~/lib/export/formats";
import { fileWriter } from "~/lib/export/writers";
import { loadTestDocumentExport } from "~/server/courseExport.server";

/**
 * Resource route (no UI): GET /courses/:id/assessments/:assessmentId/:document/export/:format →
 * a document of one test as a file. PDF goes through the print page; anything else is a 404.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const writer = fileWriter(params.format);
  if (!writer) throw new Response("Not Found", { status: 404 });
  const { doc, formats, fileBase } = await loadTestDocumentExport(request, params);
  if (!formats.includes(params.format as ExportFormat))
    throw new Response("Not Found", { status: 404 });
  return new Response(await writer.write(doc), {
    headers: attachmentHeaders(safeFileName(fileBase, params.format, "export"), writer.type),
  });
}
