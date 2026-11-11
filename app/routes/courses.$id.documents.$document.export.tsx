import type { Route } from "./+types/courses.$id.documents.$document.export";
import { loadCourseDocumentExport } from "~/server/courseExport.server";

/**
 * Resource route (no UI): GET /courses/:id/documents/:document/export → a document of the
 * whole course (the module guide) as an `ExportDoc` plus the formats to download, for the export
 * panel's preview.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { doc, formats, hrefs } = await loadCourseDocumentExport(request, params);
  return { doc, downloads: formats.map((format) => ({ format, href: hrefs[format] })) };
}
