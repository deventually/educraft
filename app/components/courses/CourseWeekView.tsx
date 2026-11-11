import { useId, useState } from "react";
import { BookOpen, CircleCheck, ClipboardList } from "lucide-react";
import { forDiscipline, weekPlan, type PlanItem } from "~/lib/courses/weekPlan";
import type { CourseData } from "~/lib/courses/types";
import type { CourseTools } from "~/lib/registry/courseActions";
import { type LocalizedText, loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { cn } from "~/lib/utils";
import { Label, Select } from "~/components/ui";
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
 * "Per week" on the course page (P27.4): a timeline of the course weeks with their lessons
 * and tests, those without a week at the end. The current week stands out. Every item
 * shows its tool buttons and the work linked to it. It only shows and links; the sections
 * below stay the place to edit.
 */
export function CourseWeekView({
  courseId,
  data,
  tools,
  work,
  weekDates = null,
  currentWeek = null,
}: {
  courseId: string;
  data: CourseData;
  tools: CourseTools;
  work: WeekWork[];
  weekDates?: string[] | null;
  /** The course week today falls in, or null. */
  currentWeek?: number | null;
}) {
  const t = useT();
  const m = t.courseTools;
  const id = useId();
  const disciplines = data.disciplines ?? [];
  const [disciplineId, setDisciplineId] = useState("");
  const plan = forDiscipline(weekPlan(data), disciplineId || null);
  const disciplineName = (item: PlanItem) =>
    disciplines.find((d) => d.id === item.disciplineId)?.name ?? null;
  const groups = [
    ...plan.weeks.map((w) => ({
      key: `w${w.week}`,
      marker: String(w.week),
      title: <WeekLabel week={w.week} weekDates={weekDates} />,
      items: w.items,
      current: w.week === currentWeek,
    })),
    ...(plan.unscheduled.length > 0
      ? [
          {
            key: "none",
            marker: "–",
            title: <>{m.unscheduled}</>,
            items: plan.unscheduled,
            current: false,
          },
        ]
      : []),
  ];
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {m.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{m.intro}</p>
      {disciplines.length > 0 && (
        <div className="mt-3 max-w-xs">
          <Label htmlFor={`${id}-discipline`}>{m.discipline}</Label>
          <Select
            id={`${id}-discipline`}
            value={disciplineId}
            onChange={(e) => setDisciplineId(e.target.value)}
            className="mt-1"
          >
            <option value="">{m.allDisciplines}</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      {groups.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-6 text-center text-sm text-slate-600">
          {m.empty}
        </p>
      ) : (
        <ol className="relative mt-5 list-none space-y-6 p-0 before:absolute before:top-4 before:bottom-4 before:left-4 before:w-px before:bg-slate-200">
          {groups.map((g) => (
            <li
              key={g.key}
              aria-current={g.current ? "date" : undefined}
              className="relative pl-12"
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-0 left-0 grid size-8 place-items-center rounded-full border text-xs font-semibold tabular-nums",
                  g.current
                    ? "border-violet-600 bg-violet-600 text-white shadow-sm ring-4 ring-violet-100"
                    : "border-slate-300 bg-white text-slate-600",
                )}
              >
                {g.marker}
              </span>
              <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
                <h3
                  className={cn(
                    "text-sm font-semibold",
                    g.current ? "text-violet-700" : "text-slate-700",
                  )}
                >
                  {g.title}
                </h3>
                {g.current && (
                  <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                    {m.thisWeek}
                  </span>
                )}
              </div>
              <ul className="mt-2 grid list-none gap-2 p-0">
                {g.items.map((item) => (
                  <WeekItem
                    key={item.id}
                    courseId={courseId}
                    item={item}
                    discipline={disciplineName(item)}
                    tools={tools[item.kind]}
                    work={work.filter((w) => w.itemId === item.id)}
                    current={g.current}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function WeekItem({
  courseId,
  item,
  discipline,
  tools,
  work,
  current,
}: {
  courseId: string;
  item: PlanItem;
  discipline: string | null;
  tools: CourseTools["activity"];
  work: WeekWork[];
  current: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-GB" : "nl-NL";
  const isTest = item.kind === "assessment";
  const KindIcon = isTest ? ClipboardList : BookOpen;
  return (
    <li
      id={`week-item-${item.id}`}
      className={cn(
        "rounded-2xl border bg-white p-4 shadow-sm",
        current ? "border-violet-200" : "border-slate-200",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            isTest ? "bg-amber-50 text-brass-600" : "bg-violet-50 text-violet-600",
          )}
        >
          <KindIcon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">{item.title}</p>
          <p className="text-xs text-slate-500">
            {isTest ? t.week.kindAssessment : t.week.kindActivity}
            {discipline && ` · ${discipline}`}
          </p>
          {work.length > 0 && (
            <ul className="mt-2 flex list-none flex-wrap gap-1.5 p-0">
              {work.map((w) => (
                <li
                  key={w.generationId}
                  className="inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2 py-0.5 text-xs text-leaf-700"
                >
                  <CircleCheck className="size-3.5" aria-hidden />
                  <span className="sr-only">{t.courseTools.made}: </span>
                  <span>
                    {typeof w.toolName === "string" ? w.toolName : loc(w.toolName, locale)} ·{" "}
                    {new Date(w.createdAt).toLocaleDateString(dateLocale, {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ItemTools
            tools={tools}
            courseId={courseId}
            itemId={item.id}
            itemTitle={item.title}
            className="mt-3"
          />
        </div>
      </div>
    </li>
  );
}
