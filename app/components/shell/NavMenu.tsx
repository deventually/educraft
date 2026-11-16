import { useRef } from "react";
import { NavLink } from "react-router";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";
import type { MenuEntry, MenuGroup } from "~/lib/nav/menu";
import { navLinkClass } from "./nav";
import { useDisclosure } from "./useDisclosure";

type Submenu = Extract<MenuEntry, { kind: "menu" }>;

/**
 * One submenu of the header (Onderwijs, Tools, Beheer), after the WAI-ARIA APG "disclosure
 * navigation" pattern like the account menu: a button opens a panel of plain links; a click,
 * Enter or Space opens it, Escape and a click outside close it, the arrow keys move through
 * its links. The header keeps which one is open, so only one is open at a time.
 */
export function NavMenu({
  entry,
  open,
  active,
  onOpenChange,
}: {
  entry: Submenu;
  open: boolean;
  active: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = () => onOpenChange(false);
  const { onKeyDown } = useDisclosure({ open, close, button, panel });
  const panelId = `submenu-${entry.id}`;
  const wide = entry.groups.length > 2;
  return (
    // A top-level item of the header's list; it handles the keys for its button and panel.
    <li className="relative" onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
        className={cn(navLinkClass(active || open), "inline-flex items-center gap-1")}
      >
        {entry.label}
        <ChevronDown className={cn("size-4", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div
          ref={panel}
          id={panelId}
          className={cn(
            "absolute left-0 z-20 mt-2 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-lg",
            // A long menu (Beheer) in two columns, so it fits on a laptop screen.
            wide ? "w-[40rem]" : "w-72",
          )}
        >
          <MenuGroups groups={entry.groups} idPrefix={panelId} onNavigate={close} columns={wide} />
        </div>
      )}
    </li>
  );
}

/** The groups of a submenu: a heading per group (when it has one) over a list of links. */
export function MenuGroups({
  groups,
  idPrefix,
  onNavigate,
  columns = false,
}: {
  groups: MenuGroup[];
  idPrefix: string;
  onNavigate: () => void;
  columns?: boolean;
}) {
  return (
    <div className={cn("gap-2", columns ? "grid grid-cols-2" : "flex flex-col")}>
      {groups.map((group, i) => {
        const headingId = `${idPrefix}-${i}`;
        return (
          <div
            key={headingId}
            className={cn(
              i > 0 && !columns && "border-t border-slate-100 pt-2",
              // In two columns the first group (the overview) spans both.
              columns && i === 0 && "col-span-2 border-b border-slate-100 pb-2",
            )}
          >
            {group.heading && (
              <p
                id={headingId}
                className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {group.heading}
              </p>
            )}
            <ul
              aria-labelledby={group.heading ? headingId : undefined}
              className="flex flex-col gap-0.5"
            >
              {group.links.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.end}
                    onClick={onNavigate}
                    aria-describedby={
                      link.description ? descriptionId(idPrefix, link.to) : undefined
                    }
                    className={({ isActive }) => cn(navLinkClass(isActive), "block")}
                  >
                    <span className="block">{link.label}</span>
                    {link.description && (
                      // Read as the link's description, not as part of its name.
                      <span
                        id={descriptionId(idPrefix, link.to)}
                        aria-hidden
                        className="block text-xs font-normal text-slate-500"
                      >
                        {link.description}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

const descriptionId = (prefix: string, to: string) => `${prefix}${to.replaceAll("/", "-")}-desc`;
