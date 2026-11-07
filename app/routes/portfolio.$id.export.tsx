import type { Route } from "./+types/portfolio.$id.export";
import { DOCX_TYPE } from "~/lib/export/docx";
import { attachmentHeaders } from "~/lib/export/filename";
import { buildDossierDocx } from "~/lib/portfolio/export";
import { dossierExport } from "~/server/portfolioExport.server";

/**
 * Resource route (no UI): GET /portfolio/:id/export → the dossier, or one learning
 * outcome of it, as a .docx download (brief P25.6). The query (`lu`, `draft`, `ai`)
 * and the open-spot rule live in `dossierExport`, shared with the print page (PDF).
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const out = await dossierExport(request, params.id);
  if (out instanceof Response) return out;
  const bytes = await buildDossierDocx(out.input);
  return new Response(bytes, { headers: attachmentHeaders(out.file, DOCX_TYPE) });
}
