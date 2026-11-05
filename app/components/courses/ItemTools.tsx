import { Link } from "react-router";
import { ArrowRight, Wrench } from "lucide-react";
import { ToolIcon } from "~/components/ToolIcon";
import { courseToolHref, type ToolRef } from "~/lib/registry/courseActions";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { cn } from "~/lib/utils";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600";

/**
 * The tool buttons of one course item (P27.4): each opens the tool for this course and
 * this item (`?course=&item=`), so it opens filled in and the result lands at the item.
 * The first is the preferred tool and stands out; the accessible name adds the item
 * title, so every link has its own name.
 */
export function ItemTools({
  tools,
  courseId,
  itemId,
  itemTitle,
  className,
}: {
  tools: ToolRef[];
  courseId: string;
  /** An activity or test; null for an outcome (a result is linked to the course). */
  itemId: string | null;
  itemTitle: string;
  className?: string;
}) {
  const locale = useLocale();
  if (tools.length === 0) return null;
  return (
    <ul className={cn("flex list-none flex-wrap gap-2 p-0", className)}>
      {tools.map((tool, i) => (
        <li key={tool.slug}>
          <Link
            to={courseToolHref(tool.slug, courseId, itemId)}
            aria-label={`${loc(tool.name, locale)}: ${itemTitle}`}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium shadow-sm transition-colors",
              i === 0
                ? "border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100"
                : "border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:text-violet-700",
              focus,
            )}
          >
            <ToolIcon name={tool.icon} className="size-3.5 shrink-0" />
            {loc(tool.name, locale)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** One quiet text link to a tool, for a row of the week on Start (P27.4). */
export function RowTool({
  tool,
  courseId,
  itemId,
  itemTitle,
}: {
  tool: ToolRef;
  courseId: string;
  itemId: string;
  itemTitle: string;
}) {
  const locale = useLocale();
  return (
    <Link
      to={courseToolHref(tool.slug, courseId, itemId)}
      aria-label={`${loc(tool.name, locale)}: ${itemTitle}`}
      className={cn(
        "group/tool rounded text-xs font-medium text-violet-700 hover:text-violet-900",
        focus,
      )}
    >
      <ToolIcon name={tool.icon} className="mr-1 inline size-3.5 align-[-3px]" />
      {loc(tool.name, locale)}
      <ArrowRight
        className="ml-1 inline size-3.5 align-[-3px] transition-transform group-hover/tool:translate-x-0.5"
        aria-hidden
      />
    </Link>
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
    <Link
      to={courseToolHref(tool.slug, courseId, itemId)}
      className={cn(
        "mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-100",
        focus,
      )}
    >
      <Wrench className="size-3.5" aria-hidden />
      {fmt(t.courseTools.solveWith, { tool: loc(tool.name, locale) })}
    </Link>
  );
}
