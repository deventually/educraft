import { useId, useState } from "react";
import { Form } from "react-router";
import { Modal } from "./Modal";
import { Button, Input, Label } from "./ui";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ConfirmDialogProps {
  /** Trigger button. `iconOnly` turns `triggerLabel` into an aria-label only. */
  triggerLabel: string;
  triggerIcon?: React.ReactNode;
  triggerIconOnly?: boolean;
  /** Added to the visible label in the name, e.g. what "Weghalen" acts on ("Weghalen: X"). */
  triggerContext?: string;
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
  /**
   * Extra inputs POSTed with the hidden `fields` (e.g. a new password and its
   * confirmation). Rendered inside the form, between the description and the buttons.
   * Mark the first one `data-autofocus`: it gets the focus on open instead of Cancel.
   */
  children?: React.ReactNode;
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
  triggerContext,
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
  children,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const titleId = useId();
  const descId = useId();
  const inputId = useId();

  const close = () => setOpen(false);

  const confirmDisabled = typeToConfirm ? typed.trim() !== typeToConfirm.word.trim() : false;

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        aria-label={
          triggerIconOnly
            ? triggerLabel
            : triggerContext
              ? `${triggerLabel}: ${triggerContext}`
              : undefined
        }
        onClick={() => {
          setTyped("");
          setOpen(true);
        }}
      >
        {triggerIcon}
        {!triggerIconOnly && triggerLabel}
      </Button>

      {open && (
        <Modal titleId={titleId} descriptionId={descId} onClose={close}>
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

          <Form method="post" onSubmit={close}>
            {Object.entries(fields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            {children && <div className="mt-4 space-y-4">{children}</div>}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={close}
                // The fallback: a field marked earlier in the dialog (the type-to-confirm
                // input, or a child) comes first in document order and wins.
                data-autofocus
              >
                {cancelLabel}
              </Button>
              <Button type="submit" variant={confirmVariant} disabled={confirmDisabled}>
                {confirmLabel}
              </Button>
            </div>
          </Form>
        </Modal>
      )}
    </>
  );
}
