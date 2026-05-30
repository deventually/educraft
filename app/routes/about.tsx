import type { Route } from "./+types/about";
import { ALL_TOOLS } from "~/lib/registry";
import { BOOK, LICENSE_URL } from "~/lib/prompts/attribution";
import { Card } from "~/components/ui";
import { useT, useLocale } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";

export function loader() {
  return {
    tools: ALL_TOOLS.filter((t) => t.enabled).map((t) => ({
      name: t.name,
      userType: t.userType,
    })),
  };
}

export default function About({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const groups = [
    { key: "instructor", label: t.home.instructor },
    { key: "student", label: t.home.student },
  ].map((g) => ({
    ...g,
    tools: loaderData.tools.filter((tl) => tl.userType === g.key),
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

      <h2 className="mt-8 text-lg font-semibold text-slate-900">{t.about.toolsHeading}</h2>
      <div className="mt-3 space-y-4">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="mb-2 text-sm font-semibold text-violet-700">{group.label}</div>
            <div className="flex flex-wrap gap-2">
              {group.tools.map((tl) => (
                <span
                  key={loc(tl.name, locale)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm"
                >
                  {loc(tl.name, locale)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
