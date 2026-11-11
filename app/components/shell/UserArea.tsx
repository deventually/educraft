import { useCallback, useRef, useState } from "react";
import { Form, NavLink } from "react-router";
import { LogOut } from "lucide-react";
import { cn } from "~/lib/utils";
import { type NavItem, navLinkClass } from "./nav";
import { useDisclosure } from "./useDisclosure";

/**
 * The account menu (P27.3): the name opens a small disclosure with Account and
 * Onderwijscontext; logging out stays one click. Native <details>, so it works without JS;
 * with JS, Escape, a click outside and the arrow keys work too (`useDisclosure`).
 */
export function UserArea({
  name,
  links,
  logoutLabel,
  loggedInAs,
  accountLabel,
}: {
  name: string;
  links: NavItem[];
  logoutLabel: string;
  loggedInAs: string;
  accountLabel: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => {
    ref.current?.removeAttribute("open");
    setOpen(false);
  }, []);
  const { onKeyDown } = useDisclosure({ open, close, button: summary, panel });
  return (
    <div className="ml-1 flex items-center gap-1.5">
      <details
        ref={ref}
        onToggle={(e) => setOpen(e.currentTarget.open)}
        onKeyDown={onKeyDown}
        className="relative hidden sm:block"
      >
        <summary
          ref={summary}
          title={loggedInAs.replace("{name}", name)}
          className="block max-w-[10rem] cursor-pointer list-none truncate rounded-md px-1.5 py-1 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 [&::-webkit-details-marker]:hidden"
        >
          {name}
        </summary>
        <nav
          ref={panel}
          aria-label={accountLabel}
          className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
        >
          <ul className="flex flex-col gap-1">
            {links.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={close}
                  className={({ isActive }) => cn(navLinkClass(isActive), "block")}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </details>
      <Form method="post" action="/logout">
        <button
          type="submit"
          aria-label={logoutLabel}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </Form>
    </div>
  );
}
