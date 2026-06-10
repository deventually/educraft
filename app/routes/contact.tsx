import { Card } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { SITE } from "~/lib/site";

export function meta() {
  return [{ title: "Contact — LimeOnIt" }];
}

export default function Contact() {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.pages.contact.heading}
      </h1>
      <p className="mt-3 text-slate-600">{t.pages.contact.intro}</p>
      <Card className="mt-6 p-5">
        <p className="text-sm font-semibold text-slate-900">{t.pages.contact.emailLabel}</p>
        <a
          href={`mailto:${SITE.contactEmail}`}
          className="mt-1 inline-block text-violet-600 hover:underline"
        >
          {SITE.contactEmail}
        </a>
        <p className="mt-4 text-sm text-slate-500">{t.pages.contact.placeholder}</p>
      </Card>
    </div>
  );
}
