/**
 * Loads a document made from one test of a course for the export routes. Which documents
 * exist is data (`TEST_DOCUMENTS`): the blueprint and the marking model. Reading follows
 * `loadCourse`: the owner and the course's members; anyone else, an unknown document, or a test
 * the document cannot be made for gets a 404.
 */
import { loadCourse } from "./courses.server";
import type { ExportDoc } from "~/lib/export/doc";
import { type ExportFormat, formatsFor } from "~/lib/export/formats";
import { markingModelDoc } from "~/lib/courses/markingModel";
import { testBlueprintDoc } from "~/lib/courses/testBlueprint";
import type { CourseSource } from "~/lib/courses/testDocument";
import { getMessages, type Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { getLocale } from "~/lib/i18n/locale.server";

type DocumentMaker = (
  course: CourseSource,
  assessmentId: string,
  locale: Locale,
) => ExportDoc | null;

/** The URL segment of each document and how it is made. */
const TEST_DOCUMENTS: Record<string, { make: DocumentMaker; fileName: (l: Locale) => string }> = {
  blueprint: {
    make: testBlueprintDoc,
    fileName: (l) => getMessages(l).courseDocuments.blueprint.fileName,
  },
  "marking-model": {
    make: markingModelDoc,
    fileName: (l) => getMessages(l).courseDocuments.markingModel.fileName,
  },
};

export interface LoadedCourseExport {
  doc: ExportDoc;
  formats: ExportFormat[];
  /** The download name without extension. */
  fileBase: string;
  /** The link per format: PDF through the print page, the rest as a file. */
  hrefs: Record<ExportFormat, string>;
}

const notFound = () => new Response("Not Found", { status: 404 });

export async function loadTestDocumentExport(
  request: Request,
  params: { id?: string; assessmentId?: string; document?: string },
): Promise<LoadedCourseExport> {
  const kind = Object.hasOwn(TEST_DOCUMENTS, params.document ?? "")
    ? TEST_DOCUMENTS[params.document ?? ""]
    : undefined;
  if (!kind) throw notFound();
  const { course } = await loadCourse(request, params.id);
  const locale = getLocale(request);
  const a = course.data.assessments.find((x) => x.id === params.assessmentId);
  const doc = a ? kind.make(course, a.id, locale) : null;
  if (!a || !doc) throw notFound();
  const base = `/courses/${encodeURIComponent(course.id)}/assessments/${encodeURIComponent(a.id)}/${params.document}`;
  return {
    doc,
    formats: formatsFor(doc.sections.map((s) => s.kind)),
    fileBase: fmt(kind.fileName(locale), { course: course.name, assessment: a.title }),
    hrefs: { docx: `${base}/export/docx`, pdf: `${base}/print`, md: `${base}/export/md` },
  };
}
