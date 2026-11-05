import { Link } from "react-router";
import { Wrench } from "lucide-react";
import { courseToolHref, type ToolRef } from "~/lib/registry/courseActions";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";

const chip =
  "inline-flex items-center gap-1 rounded-full border border-lime-300 bg-lime-50 px-2.5 py-1 text-xs font-medium text-lime-900 hover:bg-lime-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-700";

/**
 * The tool buttons of one course item (P27.4): each opens the tool for this course and
 * this item (`?course=&item=`), so it opens filled in and the result lands at the item.
 * The accessible name adds the item title, so every link has its own name.
 */
export function ItemTools({
  tools,
  courseId,
  itemId,
  itemTitle,
}: {
  tools: ToolRef[];
  courseId: string;
  /** An activity or test; null for an outcome (a result is linked to the course). */
  itemId: string | null;
  itemTitle: string;
}) {
  const locale = useLocale();
  if (tools.length === 0) return null;
  return (
    <ul className="mt-1.5 flex list-none flex-wrap gap-1.5 p-0">
      {tools.map((tool) => (
        <li key={tool.slug}>
          <Link
            to={courseToolHref(tool.slug, courseId, itemId)}
            aria-label={`${loc(tool.name, locale)}: ${itemTitle}`}
            className={chip}
          >
            {loc(tool.name, locale)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** "Los op met…" (P27.4): one tool for a finding, for the course and the item it is about. */
export function SolveWith({
  tool,
  courseId,
  itemId,
}: {
  tool: ToolRef;
  courseId: string;
  itemId: string | null;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <Link to={courseToolHref(tool.slug, courseId, itemId)} className={`mt-2 ${chip}`}>
      <Wrench className="size-3.5" aria-hidden />
      {fmt(t.courseTools.solveWith, { tool: loc(tool.name, locale) })}
    </Link>
  );
}
