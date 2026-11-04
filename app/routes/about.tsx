import type { Route } from "./+types/about";
import { requireUser } from "~/server/auth.server";
import { BOOK, LICENSE_URL } from "~/lib/prompts/attribution";
import { Card } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return {};
}

export default function About() {
  const t = useT();
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
    </div>
  );
}
