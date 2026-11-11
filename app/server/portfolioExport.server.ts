import { redirect } from "react-router";
import { getLocale } from "~/lib/i18n/locale.server";
import { getMessages } from "~/lib/i18n";
import { aiDisclosure } from "~/lib/portfolio/aiDisclosure";
import { dossierPart } from "~/lib/portfolio/dossierPart";
import { type DossierExportInput, exportFileName } from "~/lib/portfolio/export";
import { outcomeLabel } from "~/lib/portfolio/format";
import { openSpots } from "~/lib/portfolio/openSpots";
import { dossierHref } from "~/lib/portfolio/tabs";
import { loadDossier } from "./portfolio.server";

/**
 * What a dossier export (Word, or the print page for PDF) gets from the request:
 *   `?lu=<outcomeId>` one learning outcome as its own document (404 if unknown),
 *   `?draft=1`        the draft version, always allowed and marked as such,
 *   `?ai=1`           the AI-use disclosure from the dossier's own `aiLog`.
 * Only the owner gets it (`loadDossier`: 404 otherwise). While an open spot is left in
 * what is exported, the final version is a redirect to the check (BESLUIT-2026-11-07-4).
 */
export async function dossierExport(
  request: Request,
  id: string | undefined,
): Promise<{ input: DossierExportInput; file: string; dossierId: string } | Response> {
  const { dossier } = await loadDossier(request, id);
  const locale = getLocale(request);
  const query = new URL(request.url).searchParams;
  const draft = query.get("draft") === "1";
  const lu = query.get("lu");

  const data = lu ? dossierPart(dossier.data, lu) : dossier.data;
  if (!data) throw new Response("Not Found", { status: 404 });
  if (!draft && openSpots(data).length > 0)
    return redirect(dossierHref(dossier.id, "finish", "readiness"));

  const outcome = lu ? data.framework.outcomes[0] : undefined;
  const label = outcome ? outcomeLabel(outcome) : undefined;
  const code = outcome ? outcome.code.trim() || outcome.title.trim() : undefined;
  const withAi = query.get("ai") === "1";
  return {
    dossierId: dossier.id,
    input: {
      name: dossier.name,
      data,
      locale,
      now: Date.now(),
      aiDisclosure: withAi ? (aiDisclosure(data, locale) ?? undefined) : undefined,
      draft,
      ...(label ? { subtitle: label } : {}),
    },
    file: exportFileName(code ? `${dossier.name} - ${code}` : dossier.name, {
      draft: draft ? getMessages(locale).portfolioExport.draftFile : undefined,
    }),
  };
}
