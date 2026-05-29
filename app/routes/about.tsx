import type { Route } from "./+types/about";
import { ALL_TOOLS } from "~/lib/registry";
import { BOOK, LICENSE_URL } from "~/lib/prompts/attribution";
import { Badge, Card } from "~/components/ui";
import { useT, useLocale } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";

export function loader() {
  return {
    tools: ALL_TOOLS.map((t) => ({
      name: t.name,
      phase: t.phase,
      enabled: t.enabled,
      userType: t.userType,
    })),
  };
}

export default function About({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const phaseLabels: Record<number, string> = {
    1: t.about.phase1,
    2: t.about.phase2,
    3: t.about.phase3,
    4: t.about.phase4,
  };
  const byPhase = [1, 2, 3, 4].map((p) => ({
    phase: p,
    tools: loaderData.tools.filter((tl) => tl.phase === p),
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.about.heading}
      </h1>
      <p className="mt-3 text-slate-600">
        {t.about.intro1} <span className="font-medium">{BOOK.bookTitle}</span>{" "}
        {fmt(t.about.intro2, { editor: BOOK.editor, year: BOOK.year })}
      </p>

      <Card className="mt-6 p-5">
        <h2 className="font-semibold text-slate-900">{t.about.licenseHeading}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {t.about.licenseBody1} <span className="italic">{BOOK.bookTitle}</span>{" "}
          {fmt(t.about.licenseBody2, { doi: BOOK.doi })}{" "}
          <a
            href={LICENSE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-violet-600 hover:underline"
          >
            {BOOK.license}
          </a>
          {t.about.licenseBody3}
        </p>
      </Card>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">{t.about.roadmapHeading}</h2>
      <div className="mt-3 space-y-4">
        {byPhase.map(({ phase, tools }) => (
          <div key={phase}>
            <div className="mb-2 text-sm font-semibold text-violet-700">{phaseLabels[phase]}</div>
            <div className="flex flex-wrap gap-2">
              {tools.map((tl) => (
                <span
                  key={loc(tl.name, locale)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm"
                >
                  {loc(tl.name, locale)}
                  {!tl.enabled && <Badge>{t.home.comingSoon}</Badge>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
