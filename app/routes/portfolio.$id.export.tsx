import type { Route } from "./+types/portfolio.$id.export";
import { getLocale } from "~/lib/i18n/locale.server";
import { buildDossierDocx, exportFileName } from "~/lib/portfolio/export";
import { requireRole } from "~/server/auth.server";
import { getDossier } from "~/server/repositories/portfolio.server";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Resource route (no UI): GET /portfolio/:id/export → the dossier as a .docx
 * download (brief P25.6). Only the owner gets it; anyone else gets a 404, so
 * the id does not even confirm that a dossier exists.
 *
 * The AI disclosure is not wired yet: it arrives with the coach (P25.5), which
 * passes `aiDisclosure` when the teacher turns it on.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireRole(request, "teacher", "admin");
  const dossier = await getDossier(user.id, params.id);
  if (!dossier) throw new Response("Not Found", { status: 404 });

  const bytes = await buildDossierDocx({
    name: dossier.name,
    data: dossier.data,
    locale: getLocale(request),
    now: Date.now(),
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
