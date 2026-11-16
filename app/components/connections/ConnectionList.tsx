import { useId } from "react";
import { Link } from "react-router";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useT } from "~/lib/i18n/useT";

export interface ConnectionItem {
  id: string;
  name: string;
  href?: string;
  /** A short line under the name, such as "8 leden" or "jaar 1, periode 2". */
  meta?: React.ReactNode;
  /** Controls of its own, left of Weghalen (move a course, make someone lead). */
  actions?: React.ReactNode;
  /** Weghalen: always asks first, and says the thing itself stays. */
  remove?: { fields: Record<string, string>; title: string; description: string };
}

/**
 * A list of connections (plan "eenvoudiger beheer en navigatie", step 3): a heading with the
 * "… toevoegen" button on the right, one row per item with Weghalen on the right, and a line
 * that says so when it is empty. Every screen that links things uses it, so adding and
 * removing work the same everywhere.
 */
export function ConnectionList({
  title,
  intro,
  empty,
  add,
  items,
  headingLevel = 2,
}: {
  title: string;
  intro?: string;
  empty: string;
  add?: React.ReactNode;
  items: ConnectionItem[];
  headingLevel?: 2 | 3;
}) {
  const t = useT();
  const id = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby={id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading
          id={id}
          className={
            headingLevel === 2
              ? "text-lg font-medium text-slate-900"
              : "text-sm font-semibold text-slate-800"
          }
        >
          {title}
        </Heading>
        {add}
      </div>
      {intro && <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{intro}</p>}
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                {item.href ? (
                  <Link
                    to={item.href}
                    className="rounded font-medium text-slate-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-900">{item.name}</span>
                )}
                {item.meta && <p className="text-sm text-slate-600">{item.meta}</p>}
              </div>
              {(item.actions || item.remove) && (
                <div className="flex flex-wrap items-end gap-2">
                  {item.actions}
                  {item.remove && (
                    <ConfirmDialog
                      triggerLabel={t.connections.remove}
                      triggerContext={item.name}
                      triggerVariant="ghost"
                      title={item.remove.title}
                      description={item.remove.description}
                      confirmLabel={t.connections.remove}
                      confirmVariant="primary"
                      cancelLabel={t.confirm.cancel}
                      fields={item.remove.fields}
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
