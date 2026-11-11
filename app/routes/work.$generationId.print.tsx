import type { Route } from "./+types/work.$generationId.print";
import { PrintView } from "~/components/export/PrintView";
import { loadExport } from "~/server/export.server";

/**
 * GET /work/:generationId/print → the result as a printable page (brief P30.2). Same access
 * rule as the export: owner or read access.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { doc, formats } = await loadExport(request, params.generationId);
  if (!formats.includes("pdf")) throw new Response("Not Found", { status: 404 });
  return { doc };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: data?.doc.title ?? "LimeOnIt" }];
}

export default function PrintPage({ loaderData }: Route.ComponentProps) {
  return <PrintView doc={loaderData.doc} />;
}
