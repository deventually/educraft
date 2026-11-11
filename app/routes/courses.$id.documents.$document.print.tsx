import type { Route } from "./+types/courses.$id.documents.$document.print";
import { PrintView } from "~/components/export/PrintView";
import { loadCourseDocumentExport } from "~/server/courseExport.server";

/**
 * GET /courses/:id/documents/:document/print → a document of the whole course as a
 * printable page; the browser saves it as PDF (P30.2). Same access rule as the course.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { doc } = await loadCourseDocumentExport(request, params);
  return { doc };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: data?.doc.title ?? "LimeOnIt" }];
}

export default function CourseDocumentPrintPage({ loaderData }: Route.ComponentProps) {
  return <PrintView doc={loaderData.doc} />;
}
