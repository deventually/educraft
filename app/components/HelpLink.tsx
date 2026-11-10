import { Link } from "react-router";
import { CircleHelp } from "lucide-react";
import { useT } from "~/lib/i18n/useT";

/**
 * The one way a screen points to its help: a quiet "Hoe werkt dit?" under the page title.
 * Only on screens where an explanation helps; never next to a button or inside a form.
 */
export function HelpLink({ topic }: { topic: string }) {
  const t = useT();
  return (
    <p className="mt-2 text-sm">
      <Link
        to={`/help/${topic}`}
        className="inline-flex items-center gap-1.5 font-medium text-violet-700 underline-offset-2 hover:underline"
      >
        <CircleHelp className="size-4" aria-hidden />
        {t.help.howItWorks}
      </Link>
    </p>
  );
}
