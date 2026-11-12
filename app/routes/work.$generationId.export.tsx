import type { Route } from "./+types/work.$generationId.export";
import { downloadHref, loadExport, templatesFor } from "~/server/export.server";

/**
 * Resource route (no UI): GET /work/:generationId/export → the result as an `ExportDoc` plus
 * the formats to download (brief P30.1). The "Exporteer" menu shows it as a preview before
 * downloading; the file is made from the same model. Owner or read access only, else 404.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { doc, formats } = await loadExport(request, params.generationId);
  return {
    doc,
    downloads: formats.map((format) => ({
      format,
      href: downloadHref(request, params.generationId, format),
    })),
    // Without the file: only what the export panel shows to choose one (P30.7b).
    templates: (await templatesFor(request, formats)).map(({ id, name, scope, teamName }) => ({
      id,
      name,
      scope,
      ...(teamName ? { teamName } : {}),
    })),
  };
}
