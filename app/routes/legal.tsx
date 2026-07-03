import type { Route } from "./+types/legal";
import { Card } from "~/components/ui";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { useT } from "~/lib/i18n/useT";

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.data as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.pages.legal.heading} — ${m.appName}` }];
}

export default function Legal() {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.pages.legal.heading}
      </h1>
      <p className="mt-3 text-slate-600">{t.pages.legal.intro}</p>
      <Card className="mt-6 p-5">
        <p className="text-sm text-slate-500">{t.pages.legal.placeholder}</p>
      </Card>
    </div>
  );
}
