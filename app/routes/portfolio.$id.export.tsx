import type { Route } from "./+types/portfolio.$id.export";
import { getLocale } from "~/lib/i18n/locale.server";
import { buildDossierDocx, exportFileName } from "~/lib/portfolio/export";
import { aiDisclosure } from "~/lib/portfolio/aiDisclosure";
import { loadDossier } from "~/server/portfolio.server";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Resource route (no UI): GET /portfolio/:id/export → the dossier as a .docx
 * download (brief P25.6). Only the owner gets it; anyone else gets a 404, so
 * the id does not even confirm that a dossier exists.
 *
 * `?ai=1` adds the AI-use disclosure built from the dossier's own `aiLog`
 * (P25.5); the teacher turns it on, nothing is added by default.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { dossier } = await loadDossier(request, params.id);
  const locale = getLocale(request);
  const withAi = new URL(request.url).searchParams.get("ai") === "1";

  const bytes = await buildDossierDocx({
    name: dossier.name,
    data: dossier.data,
    locale,
    now: Date.now(),
    aiDisclosure: withAi ? (aiDisclosure(dossier.data, locale) ?? undefined) : undefined,
  });
  const file = exportFileName(dossier.name);
  // ASCII fallback for old clients, RFC 5987 for the real (UTF-8) name.
  const ascii = file.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "_");
  return new Response(bytes, {
    headers: {
      "Content-Type": DOCX,
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
