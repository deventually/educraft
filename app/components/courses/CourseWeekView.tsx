import { useId } from "react";
import { weekPlan, type PlanItem } from "~/lib/courses/weekPlan";
import type { CourseData } from "~/lib/courses/types";
import type { CourseTools } from "~/lib/registry/courseActions";
import { type LocalizedText, loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { WeekLabel } from "./fields";
import { ItemTools } from "./ItemTools";

/** Linked work as the week view needs it: at which item, made with which tool, when. */
export interface WeekWork {
  generationId: string;
  itemId: string | null;
  toolName: LocalizedText | string;
  createdAt: Date | string;
}

/**
 * "Per week" on the course page (P27.4): lessons and tests per course week, those without
 * a week at the bottom. Every item shows its tool buttons and the work linked to it. It
 * only shows and links; the sections below stay the place to edit.
 */
export function CourseWeekView({
  courseId,
  data,
  tools,
  work,
  weekDates = null,
}: {
  courseId: string;
  data: CourseData;
  tools: CourseTools;
  work: WeekWork[];
  weekDates?: string[] | null;
}) {
  const t = useT();
  const m = t.courseTools;
  const id = useId();
  const plan = weekPlan(data);
  const groups = [
    ...plan.weeks.map((w) => ({
      key: `w${w.week}`,
      title: <WeekLabel week={w.week} weekDates={weekDates} />,
      items: w.items,
    })),
    ...(plan.unscheduled.length > 0
      ? [{ key: "none", title: <>{m.unscheduled}</>, items: plan.unscheduled }]
      : []),
  ];
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {m.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{m.intro}</p>
      {groups.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{m.empty}</p>
      ) : (
        <div className="mt-3 space-y-5">
          {groups.map((g) => (
            <div key={g.key}>
              <h3 className="text-sm font-semibold text-slate-700">{g.title}</h3>
              <ul className="mt-2 list-none space-y-2 p-0">
                {g.items.map((item) => (
                  <WeekItem
                    key={item.id}
                    courseId={courseId}
                    item={item}
                    tools={tools[item.kind]}
                    work={work.filter((w) => w.itemId === item.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function WeekItem({
  courseId,
  item,
  tools,
  work,
}: {
  courseId: string;
  item: PlanItem;
  tools: CourseTools["activity"];
  work: WeekWork[];
}) {
  const t = useT();
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-GB" : "nl-NL";
  return (
    <li
      id={`week-item-${item.id}`}
      className="rounded-xl border border-slate-200 bg-white p-3 text-sm"
    >
      <p className="font-medium text-slate-900">
        {item.title}
        <span className="font-normal text-slate-500">
          {" "}
          · {item.kind === "activity" ? t.week.kindActivity : t.week.kindAssessment}
        </span>
      </p>
      <ItemTools tools={tools} courseId={courseId} itemId={item.id} itemTitle={item.title} />
      {work.length > 0 && (
        <p className="mt-1.5 text-xs text-slate-600">
          {t.courseTools.made}:{" "}
          {work.map((w, i) => (
            <span key={w.generationId}>
              {i > 0 && "; "}
              {typeof w.toolName === "string" ? w.toolName : loc(w.toolName, locale)} ·{" "}
              {new Date(w.createdAt).toLocaleDateString(dateLocale, { dateStyle: "medium" })}
            </span>
          ))}
        </p>
      )}
    </li>
  );
}
