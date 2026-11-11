/**
 * Loads a document made from a course for the export routes. Which documents exist is data:
 * per course the module guide and the module handbook (`COURSE_DOCUMENTS`), per test the blueprint and the marking model
 * (`TEST_DOCUMENTS`). Reading follows
 * `loadCourse`: the owner and the course's members; anyone else, an unknown document, or a test
 * the document cannot be made for gets a 404.
 */
import { loadCourse } from "./courses.server";
import type { ExportDoc } from "~/lib/export/doc";
import { type ExportFormat, formatsFor } from "~/lib/export/formats";
import { markingModelDoc } from "~/lib/courses/markingModel";
import { moduleGuideDoc } from "~/lib/courses/moduleGuide";
import { moduleHandbookDoc } from "~/lib/courses/moduleHandbook";
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

/** The URL segment of each document of the whole course and how it is made. */
const COURSE_DOCUMENTS: Record<
  string,
  { make: (course: CourseSource, locale: Locale) => ExportDoc; fileName: (l: Locale) => string }
> = {
  "module-guide": {
    make: moduleGuideDoc,
    fileName: (l) => getMessages(l).courseDocuments.moduleGuide.fileName,
  },
  "module-handbook": {
    make: moduleHandbookDoc,
    fileName: (l) => getMessages(l).courseDocuments.moduleHandbook.fileName,
  },
};

const pick = <T>(documents: Record<string, T>, name: string | undefined): T | undefined =>
  Object.hasOwn(documents, name ?? "") ? documents[name ?? ""] : undefined;

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
  const kind = pick(TEST_DOCUMENTS, params.document);
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
    hrefs: hrefs(base),
  };
}

export async function loadCourseDocumentExport(
  request: Request,
  params: { id?: string; document?: string },
): Promise<LoadedCourseExport> {
  const kind = pick(COURSE_DOCUMENTS, params.document);
  if (!kind) throw notFound();
  const { course } = await loadCourse(request, params.id);
  const locale = getLocale(request);
  const doc = kind.make(course, locale);
  return {
    doc,
    formats: formatsFor(doc.sections.map((s) => s.kind)),
    fileBase: fmt(kind.fileName(locale), { course: course.name }),
    hrefs: hrefs(`/courses/${encodeURIComponent(course.id)}/documents/${params.document}`),
  };
}

const hrefs = (base: string): Record<ExportFormat, string> => ({
  docx: `${base}/export/docx`,
  pdf: `${base}/print`,
  md: `${base}/export/md`,
});
