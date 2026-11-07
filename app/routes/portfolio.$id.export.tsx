import { redirect } from "react-router";
import type { Route } from "./+types/portfolio.$id.export";
import { getLocale } from "~/lib/i18n/locale.server";
import { getMessages } from "~/lib/i18n";
import { DOCX_TYPE } from "~/lib/export/docx";
import { attachmentHeaders } from "~/lib/export/filename";
import { buildDossierDocx, exportFileName } from "~/lib/portfolio/export";
import { aiDisclosure } from "~/lib/portfolio/aiDisclosure";
import { openSpots } from "~/lib/portfolio/openSpots";
import { loadDossier } from "~/server/portfolio.server";

/**
 * Resource route (no UI): GET /portfolio/:id/export → the dossier as a .docx
 * download (brief P25.6). Only the owner gets it; anyone else gets a 404, so
 * the id does not even confirm that a dossier exists.
 *
 * `?ai=1` adds the AI-use disclosure built from the dossier's own `aiLog`
 * (P25.5); the teacher turns it on, nothing is added by default.
 *
 * An open spot never reaches the handed-in version (BESLUIT-2026-11-07-4):
 * while one is left, the final version sends the teacher back to the check.
 * `?draft=1` always gives a draft version, marked as such.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { dossier } = await loadDossier(request, params.id);
  const locale = getLocale(request);
  const query = new URL(request.url).searchParams;
  const withAi = query.get("ai") === "1";
  const draft = query.get("draft") === "1";
  if (!draft && openSpots(dossier.data).length > 0)
    return redirect(`/portfolio/${dossier.id}#readiness`);

  const bytes = await buildDossierDocx({
    name: dossier.name,
    data: dossier.data,
    locale,
    now: Date.now(),
    aiDisclosure: withAi ? (aiDisclosure(dossier.data, locale) ?? undefined) : undefined,
    draft,
  });
  const file = exportFileName(dossier.name, {
    draft: draft ? getMessages(locale).portfolioExport.draftFile : undefined,
  });
  return new Response(bytes, { headers: attachmentHeaders(file, DOCX_TYPE) });
}
