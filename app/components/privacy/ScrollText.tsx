import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

/**
 * A field's text in the privacy screens, scrolling on its own: keyboard-reachable, so a long
 * text can be read without a mouse (WCAG 2.1.1).
 */
export function ScrollText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-reachable
    <div tabIndex={0} className={cn("overflow-y-auto px-3 py-2", className)}>
      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{children}</p>
    </div>
  );
}
