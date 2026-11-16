import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * The modal frame every dialog shares (`role="dialog"`, `aria-modal`): a backdrop, focus
 * moves in on open (to the first `[data-autofocus]`) and back to what had it on close,
 * Escape closes, and Tab stays inside. Render it only while open.
 */
export function Modal({
  titleId,
  descriptionId,
  onClose,
  className = "max-w-md",
  children,
}: {
  titleId: string;
  descriptionId?: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
      (el) => !el.closest("[hidden]"),
    );
    const first = focusables[0];
    const last = focusables.at(-1);
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={onKeyDown}
        className={`relative z-10 max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
