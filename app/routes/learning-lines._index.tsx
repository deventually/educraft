import { Link } from "react-router";
import { Route as RouteIcon } from "lucide-react";
import type { Route } from "./+types/learning-lines._index";
import { requireProgrammeUser } from "~/server/programmes.server";
import { listAllLines } from "~/server/repositories/learningLines.server";
import { EmptyState } from "~/components/EmptyState";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

export function meta() {
  return [{ title: "Leerlijnen — LimeOnIt" }];
}

/** Every learning line the reader reads, once, pointing at its page (plan step 4). */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireProgrammeUser(request);
  return {
    // Each line opens under the first programme the reader sees it in.
    lines: (await listAllLines(user)).flatMap((l) => {
      const first = l.programmes[0];
      return first
        ? [
            {
              id: l.id,
              name: l.name,
              href: `/programmes/${first.id}/lines/${l.id}`,
              courses: l.courses,
              programmes: l.programmes.map((p) => p.name).join(", "),
            },
          ]
        : [];
    }),
  };
}

export default function LearningLines({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const l = t.programmes.lines;
  const { lines } = loaderData;
  return (
    <div className="w-full min-w-0">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {l.allTitle}
      </h1>
      <p className="mt-2 max-w-[65ch] text-slate-600">{l.allIntro}</p>
      {lines.length === 0 ? (
        <EmptyState
          icon={<RouteIcon aria-hidden />}
          title={l.allEmptyTitle}
          body={l.allEmptyBody}
          action={{ label: t.menu.education.programmes, to: "/programmes" }}
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {lines.map((line) => (
            <li
              key={line.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <Link
                to={line.href}
                className="font-medium text-slate-900 underline-offset-2 hover:underline"
              >
                {line.name}
              </Link>
              <p className="text-sm text-slate-600">
                {line.courses === 1
                  ? fmt(l.allCourseOne, { programmes: line.programmes })
                  : fmt(l.allCourses, { courses: line.courses, programmes: line.programmes })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
