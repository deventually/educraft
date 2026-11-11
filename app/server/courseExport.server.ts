/**
 * Loads a document made from a course for the export routes: for now one test's blueprint
 * (`testBlueprintDoc`). Reading follows `loadCourse`: the owner and the course's members;
 * anyone else, or a test that is not in the course, gets a 404.
 */
import { loadCourse } from "./courses.server";
import type { ExportDoc } from "~/lib/export/doc";
import { type ExportFormat, formatsFor } from "~/lib/export/formats";
import { testBlueprintDoc } from "~/lib/courses/testBlueprint";
import { getMessages } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { getLocale } from "~/lib/i18n/locale.server";

export interface LoadedCourseExport {
  doc: ExportDoc;
  formats: ExportFormat[];
  /** The download name without extension. */
  fileBase: string;
  /** The link per format: PDF through the print page, the rest as a file. */
  hrefs: Record<ExportFormat, string>;
}

export async function loadTestBlueprintExport(
  request: Request,
  courseId: string | undefined,
  assessmentId: string | undefined,
): Promise<LoadedCourseExport> {
  const { course } = await loadCourse(request, courseId);
  const locale = getLocale(request);
  const doc = assessmentId ? testBlueprintDoc(course, assessmentId, locale) : null;
  const a = course.data.assessments.find((x) => x.id === assessmentId);
  if (!doc || !a) throw new Response("Not Found", { status: 404 });
  const base = `/courses/${encodeURIComponent(course.id)}/assessments/${encodeURIComponent(a.id)}`;
  return {
    doc,
    formats: formatsFor(doc.sections.map((s) => s.kind)),
    fileBase: fmt(getMessages(locale).courseDocuments.blueprint.fileName, {
      course: course.name,
      assessment: a.title,
    }),
    hrefs: { docx: `${base}/export/docx`, pdf: `${base}/print`, md: `${base}/export/md` },
  };
}
