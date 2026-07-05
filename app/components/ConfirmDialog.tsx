import { useEffect, useId, useRef, useState } from "react";
import { Form } from "react-router";
import { Button, Input, Label } from "./ui";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ConfirmDialogProps {
  /** Trigger button. `iconOnly` turns `triggerLabel` into an aria-label only. */
  triggerLabel: string;
  triggerIcon?: React.ReactNode;
  triggerIconOnly?: boolean;
  triggerVariant?: ButtonVariant;
  triggerSize?: "sm" | "md";
  triggerClassName?: string;
  /** Dialog copy. */
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: ButtonVariant;
  /** Hidden fields POSTed to the route action when confirmed. */
  fields: Record<string, string>;
  /** Optional gate: the confirm button stays disabled until `word` is typed. */
  typeToConfirm?: { word: string; label: string; placeholder?: string };
}

/**
 * An accessible confirm dialog for destructive actions. Renders its own trigger
 * button; opening it shows a modal (`role="dialog"`, `aria-modal`) that owns the
 * real `<Form method="post">`. Escape, the backdrop, and Cancel all dismiss it;
 * focus moves in on open and returns to the trigger on close, and a simple Tab
 * trap keeps focus inside. With `typeToConfirm`, the confirm button is disabled
 * until the exact word is typed — the extra friction for the riskiest deletes.
 */
export function ConfirmDialog({
  triggerLabel,
  triggerIcon,
  triggerIconOnly = false,
  triggerVariant = "danger",
  triggerSize = "sm",
  triggerClassName,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmVariant = "danger",
  fields,
  typeToConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const inputId = useId();

  const close = () => setOpen(false);

  // Move focus into the dialog on open; restore it to the trigger on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => previouslyFocused?.focus?.();
  }, [open]);

  const confirmDisabled = typeToConfirm ? typed.trim() !== typeToConfirm.word.trim() : false;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])',
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        aria-label={triggerIconOnly ? triggerLabel : undefined}
        onClick={() => {
          setTyped("");
          setOpen(true);
        }}
      >
        {triggerIcon}
        {!triggerIconOnly && triggerLabel}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            onKeyDown={onKeyDown}
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            <p id={descId} className="mt-2 text-sm text-slate-600">
              {description}
            </p>

            {typeToConfirm && (
              <div className="mt-4">
                <Label htmlFor={inputId}>{typeToConfirm.label}</Label>
                <Input
                  id={inputId}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  placeholder={typeToConfirm.placeholder}
                  className="mt-1"
                  data-autofocus
                />
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={close}
                {...(typeToConfirm ? {} : { "data-autofocus": true })}
              >
                {cancelLabel}
              </Button>
              <Form method="post" onSubmit={close}>
                {Object.entries(fields).map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
                <Button type="submit" variant={confirmVariant} disabled={confirmDisabled}>
                  {confirmLabel}
                </Button>
              </Form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
