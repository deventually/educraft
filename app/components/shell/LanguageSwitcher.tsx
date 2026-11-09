import { Form } from "react-router";
import { cn } from "~/lib/utils";
import { LOCALES } from "~/lib/i18n";

export function LanguageSwitcher({ current, redirectTo }: { current: string; redirectTo: string }) {
  return (
    <Form
      method="post"
      action="/set-locale"
      className="ml-1 flex items-center rounded-lg border border-slate-200 bg-white p-0.5"
    >
      <input type="hidden" name="redirectTo" value={redirectTo} />
      {LOCALES.map((loc) => (
        <button
          key={loc}
          type="submit"
          name="locale"
          value={loc}
          aria-pressed={current === loc}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors",
            current === loc ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-slate-100",
          )}
        >
          {loc}
        </button>
      ))}
    </Form>
  );
}
