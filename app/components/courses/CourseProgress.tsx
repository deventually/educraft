import { ProgressPanel } from "~/components/progress/ProgressPanel";
import type { CourseProgress as Progress, ProgressStep } from "~/lib/courses/progress";
import { courseTabHref } from "~/lib/courses/tabs";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

/**
 * Where the course stands, as the steps of backwards design (`courseProgress`), in the shared
 * `ProgressPanel`: guides the teacher, and every step leads into its tab.
 */
export function CourseProgress({ courseId, progress }: { courseId: string; progress: Progress }) {
  const t = useT();
  const p = t.courses.progress;
  const href = (s: ProgressStep) => courseTabHref(courseId, s.tab, s.anchor);
  const status = (s: ProgressStep) => {
    if (s.complete) return p.stepDone;
    const text = p.steps[s.id].status;
    if (!text.includes("{")) return text;
    return s.total > 0 ? fmt(text, { done: s.done, total: s.total }) : p.stepTodo;
  };
  const { next } = progress;
  return (
    <ProgressPanel
      title={p.title}
      intro={p.intro}
      summary={fmt(p.summary, { done: progress.complete, total: progress.total })}
      stepsLabel={p.stepsLabel}
      steps={progress.steps.map((s) => ({
        id: s.id,
        label: p.steps[s.id].title,
        status: status(s),
        complete: s.complete,
        href: href(s),
      }))}
      next={
        next && {
          id: next.id,
          heading: fmt(p.next, { step: p.steps[next.id].title }),
          how: p.steps[next.id].how,
          cta: fmt(p.goTo, {
            place: next.anchor ? p.steps[next.id].title : t.courses.tabs[next.tab],
          }),
          href: href(next),
        }
      }
      allDone={p.allDone}
    />
  );
}
