import { type KeyboardEvent, type RefObject, useEffect } from "react";

/**
 * Keyboard and pointer behaviour for a header disclosure (the account menu, the
 * mobile menu), after the WAI-ARIA APG "disclosure navigation" pattern: the links
 * stay plain links in a <nav> (no role="menu"), Tab works as everywhere else, and
 * on top of that
 * - Escape closes and returns focus to the button;
 * - a pointer press outside the button and the panel closes, and so does Tab
 *   moving the focus out (an open panel never covers the focused element);
 *   either way focus stays where the user put it;
 * - ArrowDown/ArrowUp move through the panel's links round-robin (from the button
 *   too: down to the first, up to the last); Home/End jump to the first/last link.
 *
 * Spread the returned `onKeyDown` on the element(s) that hold the button and panel.
 */
export function useDisclosure({
  open,
  close,
  button,
  panel,
}: {
  open: boolean;
  close: () => void;
  button: RefObject<HTMLElement | null>;
  panel: RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOutside = (e: Event) => {
      const target = e.target as Node;
      if (button.current?.contains(target) || panel.current?.contains(target)) return;
      close();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
    };
  }, [open, close, button, panel]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      button.current?.focus();
      return;
    }
    if (moveFocus(panel.current, e.key)) e.preventDefault();
  };
  return { onKeyDown };
}

/** Moves focus among the panel's links; returns whether it handled the key. */
function moveFocus(panel: HTMLElement | null, key: string): boolean {
  const links = Array.from(panel?.querySelectorAll<HTMLElement>("a[href]") ?? []);
  if (links.length === 0) return false;
  const last = links.length - 1;
  const at = links.indexOf(document.activeElement as HTMLElement);
  const inPanel = at >= 0;
  const next =
    key === "ArrowDown"
      ? inPanel && at < last
        ? at + 1
        : 0
      : key === "ArrowUp"
        ? inPanel && at > 0
          ? at - 1
          : last
        : inPanel && key === "Home"
          ? 0
          : inPanel && key === "End"
            ? last
            : -1;
  if (next < 0) return false;
  links[next]?.focus();
  return true;
}
