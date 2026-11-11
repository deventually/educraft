import type { Route } from "./+types/courses.$id.assessments.$assessmentId.$document.export";
import { loadTestDocumentExport } from "~/server/courseExport.server";

/**
 * Resource route (no UI): GET /courses/:id/assessments/:assessmentId/:document/export → a
 * document of one test (the blueprint or the marking model) as an `ExportDoc` plus the formats
 * to download, for the export panel's preview.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { doc, formats, hrefs } = await loadTestDocumentExport(request, params);
  return { doc, downloads: formats.map((format) => ({ format, href: hrefs[format] })) };
}
