import type { Route } from "./+types/courses.$id.assessments.$assessmentId.print";
import { PrintView } from "~/components/export/PrintView";
import { loadTestBlueprintExport } from "~/server/courseExport.server";

/**
 * GET /courses/:id/assessments/:assessmentId/print → one test's blueprint as a printable
 * page; the browser saves it as PDF (P30.2). Same access rule as the course.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { doc } = await loadTestBlueprintExport(request, params.id, params.assessmentId);
  return { doc };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: data?.doc.title ?? "LimeOnIt" }];
}

export default function BlueprintPrintPage({ loaderData }: Route.ComponentProps) {
  return <PrintView doc={loaderData.doc} />;
}
