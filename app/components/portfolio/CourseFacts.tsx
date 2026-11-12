import { Link } from "react-router";
import type { CourseFactsView } from "~/lib/portfolio/courseFacts";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

/**
 * "Uit je cursus" on the Chapter tab: what the anchor's course already says (module, schedule,
 * lesson or test). Read only; a fact is changed in the course, so the chapter and the course
 * never disagree. The course's name heads the link, so it is not repeated as a fact.
 */
export function CourseFacts({ view }: { view: CourseFactsView | null }) {
  const f = useT().portfolioFacts;
  if (!view) return null;
  const facts = view.facts.filter((x) => x.key !== "course");
  return (
    <section
      className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
      aria-labelledby="course-facts-title"
    >
      <h3 id="course-facts-title" className="font-medium text-slate-900">
        {f.title}
      </h3>
      <p className="mt-1 text-slate-700">{f.intro}</p>
      <dl className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
        {facts.map((x) => (
          <div key={x.key} className="contents">
            <dt className="text-slate-600">{f.labels[x.key]}</dt>
            <dd className="mb-1 text-slate-900 sm:mb-0">{x.value}</dd>
          </div>
        ))}
      </dl>
      <Link
        to={`/courses/${view.courseId}`}
        className="mt-3 inline-block font-medium text-violet-700 underline underline-offset-2"
      >
        {fmt(f.openCourse, { course: view.course })}
      </Link>
    </section>
  );
}
