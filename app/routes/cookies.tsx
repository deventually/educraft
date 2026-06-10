import { Card } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

export function meta() {
  return [{ title: "Privacy & cookies — LimeOnIt" }];
}

export default function Cookies() {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.pages.cookies.heading}
      </h1>
      <p className="mt-3 text-slate-600">{t.pages.cookies.intro}</p>
      <Card className="mt-6 p-5">
        <p className="text-sm text-slate-500">{t.pages.cookies.placeholder}</p>
      </Card>
    </div>
  );
}
