import type { Route } from "./+types/courses.$id.assessments.$assessmentId.$document.print";
import { PrintView } from "~/components/export/PrintView";
import { loadTestDocumentExport } from "~/server/courseExport.server";

/**
 * GET /courses/:id/assessments/:assessmentId/:document/print → a document of one test as a
 * printable page; the browser saves it as PDF (P30.2). Same access rule as the course.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { doc } = await loadTestDocumentExport(request, params);
  return { doc };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: data?.doc.title ?? "LimeOnIt" }];
}

export default function TestDocumentPrintPage({ loaderData }: Route.ComponentProps) {
  return <PrintView doc={loaderData.doc} />;
}
