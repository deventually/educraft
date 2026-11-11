import { cn } from "~/lib/utils";

/** One link in the header nav, the mobile menu or the account menu. */
export type NavItem = { to: string; label: string; end: boolean };

export function navLinkClass(isActive: boolean) {
  return cn(
    "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
    isActive
      ? "bg-violet-50 text-violet-700"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  );
}
