import { useId, useState } from "react";
import { Form } from "react-router";
import { Plus } from "lucide-react";
import { Modal } from "~/components/Modal";
import { Button } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

/**
 * "Nieuwe …" (plan "eenvoudiger beheer en navigatie", steps 3 and 6): one button above a list
 * that opens one dialog with only the name and what else is needed. Creating opens the new
 * thing's page, or the list shows it with a message; there is nothing to confirm. The fields
 * are the children; mark the first with `data-autofocus`.
 */
export function NewDialog({
  triggerLabel,
  title,
  description,
  intent,
  action,
  hidden = {},
  submitLabel,
  startOpen = false,
  triggerId,
  children,
}: {
  triggerLabel: string;
  title: string;
  description?: string;
  intent: string;
  /** Where the form posts; the current route when left out. */
  action?: string;
  hidden?: Record<string, string>;
  submitLabel: string;
  startOpen?: boolean;
  triggerId?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(startOpen);
  const close = () => setOpen(false);
  return (
    <>
      <Button id={triggerId} type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {triggerLabel}
      </Button>
      {open && (
        <Modal
          titleId={`${id}-title`}
          descriptionId={description ? `${id}-desc` : undefined}
          onClose={close}
          className="max-w-lg"
        >
          <h2 id={`${id}-title`} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          {description && (
            <p id={`${id}-desc`} className="mt-1 text-sm text-slate-600">
              {description}
            </p>
          )}
          <Form method="post" action={action} onSubmit={close} className="mt-4 grid gap-4">
            <input type="hidden" name="intent" value={intent} />
            {Object.entries(hidden).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            {children}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={close}>
                {t.confirm.cancel}
              </Button>
              <Button type="submit">{submitLabel}</Button>
            </div>
          </Form>
        </Modal>
      )}
    </>
  );
}
