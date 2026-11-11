import type { Route } from "./+types/courses.$id.assessments.$assessmentId.export";
import { loadTestBlueprintExport } from "~/server/courseExport.server";

/**
 * Resource route (no UI): GET /courses/:id/assessments/:assessmentId/export → one test's
 * blueprint as an `ExportDoc` plus the formats to download, for the export panel's preview.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { doc, formats, hrefs } = await loadTestBlueprintExport(
    request,
    params.id,
    params.assessmentId,
  );
  return { doc, downloads: formats.map((format) => ({ format, href: hrefs[format] })) };
}
