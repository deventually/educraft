/**
 * Loads a result as an `ExportDoc` for the export routes (brief P30.1). Reading follows the
 * repository rule: the owner, or a team-mate the work is shared with (`getSharedWork`, never
 * student work). Anything else, a step of another tool or an unknown tool is a 404, so the id
 * does not even confirm that the work exists.
 */
import { requireRole } from "./auth.server";
import { getGeneration } from "./repositories/generations.server";
import { getSharedWork } from "./repositories/shares.server";
import { type ExportDoc, toExportDoc } from "~/lib/export/doc";
import { type ExportFormat, formatsFor } from "~/lib/export/formats";
import { getToolBySlug } from "~/lib/registry";
import { loc } from "~/lib/i18n/localized";
import type { Locale } from "~/lib/i18n";

/** At most this many steps in one export (a tool has a handful). */
const MAX_STEPS = 10;

export interface LoadedExport {
  doc: ExportDoc;
  formats: ExportFormat[];
  /** The download name without extension: the tool's name and the date of the work. */
  fileBase: string;
}

const notFound = () => new Response("Not Found", { status: 404 });

/**
 * `generationId` is the result; `?with=<id>` adds the other saved steps of the same tool, so a
 * multi-step result becomes one file with a heading per step, in the tool's stage order.
 */
export async function loadExport(request: Request, generationId: string): Promise<LoadedExport> {
  const user = await requireRole(request, "teacher", "admin");
  const extra = new URL(request.url).searchParams.getAll("with");
  const ids = [...new Set([generationId, ...extra])];
  if (ids.length > MAX_STEPS) throw notFound();

  const rows = [];
  for (const id of ids) {
    const row = (await getGeneration(user.id, id)) ?? (await getSharedWork(user.id, id));
    if (!row) throw notFound();
    rows.push(row);
  }
  const [first] = rows;
  if (!first) throw notFound();
  const tool = getToolBySlug(first.toolSlug);
  if (!tool || rows.some((r) => r.toolSlug !== tool.slug)) throw notFound();

  const locale: Locale = first.outputLanguage === "en" ? "en" : "nl";
  const stageIndex = (stageId: string | null) => {
    const i = tool.stages.findIndex((s) => s.id === stageId);
    return Math.max(i, 0);
  };
  const sorted = [...rows].sort((a, b) => stageIndex(a.stageId) - stageIndex(b.stageId));
  const many = sorted.length > 1;
  const sections = sorted.map((r) => {
    const stage = tool.stages[stageIndex(r.stageId)];
    if (!stage) throw notFound();
    return {
      heading: many ? loc(stage.name, locale) : null,
      kind: stage.output.exportAs,
      markdown: r.outputMarkdown,
    };
  });
  const title = loc(tool.name, locale);
  const doc = toExportDoc({ title, locale, sections });
  const date = first.createdAt.toISOString().slice(0, 10);
  return {
    doc,
    formats: formatsFor(doc.sections.map((s) => s.kind)),
    fileBase: `${title} ${date}`,
  };
}

/**
 * The link for one format, carrying the extra steps along. PDF goes through the print page
 * (the browser saves it as PDF); every other format is a file download.
 */
export function downloadHref(request: Request, generationId: string, format: ExportFormat): string {
  const query = new URL(request.url).search;
  const base = `/work/${encodeURIComponent(generationId)}`;
  return format === "pdf" ? `${base}/print${query}` : `${base}/export/${format}${query}`;
}
