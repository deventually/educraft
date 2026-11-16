import { useId, useState } from "react";
import { Form } from "react-router";
import { Plus } from "lucide-react";
import { Modal } from "~/components/Modal";
import { Button, Input, Label } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

export interface AddOption {
  id: string;
  label: string;
  /** A second line, such as an e-mail address or the teams of a programme. */
  hint?: string;
}

export interface AddDialogProps {
  /** "Team toevoegen": the button above the list that opens the dialog. */
  triggerLabel: string;
  title: string;
  description?: string;
  /** The form's `intent`, and any other hidden fields. */
  intent: string;
  hidden?: Record<string, string>;
  /** Pick existing things: every ticked option posts its id as `name`. */
  pick?: { name: string; options: AddOption[]; empty: string };
  /** Own fields: instead of a list (an e-mail address), or under it (year and period). */
  children?: React.ReactNode;
}

/**
 * "… toevoegen" (plan "eenvoudiger beheer en navigatie", step 3): one button that opens one
 * dialog, everywhere something that already exists is added to a list. Search narrows the
 * options, ticks pick several at once, and Toevoegen posts them together. A screen that adds
 * by its own field (an e-mail address) passes that field as children instead of `pick`.
 */
export function AddDialog({
  triggerLabel,
  title,
  description,
  intent,
  hidden = {},
  pick,
  children,
}: AddDialogProps) {
  const t = useT();
  const c = t.connections;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState("");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const close = () => setOpen(false);

  const needle = find.trim().toLowerCase();
  const shows = (o: AddOption) =>
    !needle || `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(needle);
  const options = pick?.options ?? [];
  const nothingLeft = !!pick && options.length === 0;
  const toggle = (optionId: string, on: boolean) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(optionId);
      else next.delete(optionId);
      return next;
    });

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          setFind("");
          setTicked(new Set());
          setOpen(true);
        }}
      >
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
            <p id={`${id}-desc`} className="mt-2 text-sm text-slate-600">
              {description}
            </p>
          )}
          <Form method="post" onSubmit={close} className="mt-4 space-y-4">
            <input type="hidden" name="intent" value={intent} />
            {Object.entries(hidden).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            {nothingLeft ? (
              <p className="text-sm text-slate-600">{pick.empty}</p>
            ) : (
              pick && (
                <>
                  <div>
                    <Label htmlFor={`${id}-find`}>{c.find}</Label>
                    <Input
                      id={`${id}-find`}
                      type="search"
                      value={find}
                      onChange={(e) => setFind(e.target.value)}
                      // Enter narrows the list; it never submits the form.
                      onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                      autoComplete="off"
                      className="mt-1"
                      data-autofocus
                    />
                  </div>
                  <fieldset>
                    <legend className="sr-only">{title}</legend>
                    <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-2">
                      {options.map((o) => (
                        // `hidden`, not removed: a ticked option stays ticked while you search on.
                        <li key={o.id} hidden={!shows(o)}>
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                            <input
                              type="checkbox"
                              name={pick.name}
                              value={o.id}
                              checked={ticked.has(o.id)}
                              onChange={(e) => toggle(o.id, e.target.checked)}
                              className="mt-0.5 size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                            />
                            <span>
                              <span className="font-medium text-slate-800">{o.label}</span>
                              {o.hint && <span className="block text-slate-500">{o.hint}</span>}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    {!options.some(shows) && (
                      <p className="mt-2 text-sm text-slate-600">{c.noMatch}</p>
                    )}
                  </fieldset>
                </>
              )
            )}
            {!nothingLeft && children && <div className="space-y-4">{children}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={close}>
                {t.confirm.cancel}
              </Button>
              {!nothingLeft && (
                <Button type="submit" disabled={!!pick && ticked.size === 0}>
                  {pick && ticked.size > 0 ? fmt(c.addCount, { count: ticked.size }) : c.add}
                </Button>
              )}
            </div>
          </Form>
        </Modal>
      )}
    </>
  );
}
