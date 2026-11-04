import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "./ui";

type Action =
  | { label: string; to: string }
  | { label: string; onClick: () => void }
  /** A ready-made control, e.g. a button that opens a dialog. */
  | { node: ReactNode };

interface Props {
  icon?: ReactNode;
  title: string;
  body: string;
  action: Action;
}

/**
 * A page with nothing in it yet: says what belongs here and offers exactly one
 * next step. Static content, not a notification, so it is deliberately not a
 * live region (the P15 rule: only toasts announce).
 */
export function EmptyState({ icon, title, body, action }: Props) {
  return (
    <section className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-10 text-center">
      {icon && (
        <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-violet-50 text-violet-600 [&_svg]:size-6">
          {icon}
        </span>
      )}
      <h2 className="font-display text-lg font-medium text-slate-900">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-slate-600">{body}</p>
      <div className="mt-5">
        {"node" in action ? (
          action.node
        ) : "to" in action ? (
          <Link
            to={action.to}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            {action.label}
          </Link>
        ) : (
          <Button onClick={action.onClick}>{action.label}</Button>
        )}
      </div>
    </section>
  );
}
