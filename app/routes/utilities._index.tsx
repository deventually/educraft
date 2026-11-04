import type { Route } from "./+types/utilities._index";
import { requireUser } from "~/server/auth.server";
import { UTILITIES } from "~/lib/utilities";
import { UtilityCard } from "~/components/utilities/UtilityCard";
import { useT } from "~/lib/i18n/useT";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return null;
}

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.loaderData as { locale?: Locale } | undefined;
  return [{ title: `${getMessages(root?.locale ?? DEFAULT_LOCALE).utilities.heading} — LimeOnIt` }];
}

/** All utilities (P23): teacher tools without AI. Always on, no admin switch. */
export default function UtilitiesIndex() {
  const t = useT();
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-[clamp(1.7rem,4vw,2.05rem)] font-medium tracking-tight text-balance text-slate-900">
          {t.utilities.heading}
        </h1>
        <p className="mt-3 max-w-[60ch] text-pretty text-slate-600">{t.utilities.intro}</p>
      </div>
      <ul className="grid list-none gap-5 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr))]">
        {UTILITIES.map((u) => (
          <li key={u.id}>
            <UtilityCard utility={u} headingLevel={2} />
          </li>
        ))}
      </ul>
    </div>
  );
}
