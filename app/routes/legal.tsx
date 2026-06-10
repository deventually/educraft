import { Card } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

export function meta() {
  return [{ title: "Disclaimer — LimeOnIt" }];
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
