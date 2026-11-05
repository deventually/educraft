import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { useActionToast } from "~/components/Toast";
import { useT } from "~/lib/i18n/useT";

/** What an admin action returns when it refuses: `error` is a code, or `true`. */
type ActionResult = { error?: string | true } | undefined | null;

const NON_TEXT_INPUTS = new Set([
  "checkbox",
  "radio",
  "range",
  "file",
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "color",
]);

/** A free-text control: saved on blur / Enter, never per keystroke. */
function isTextControl(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(el.type);
}

/** A control whose every change is a finished choice: saved at once. */
function isChoiceControl(el: EventTarget | null): boolean {
  if (el instanceof HTMLSelectElement) return true;
  return el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio");
}

/** The error code of a refused save, or `undefined` for a success. */
const errorOf = (d: ActionResult): string | true | undefined =>
  d ? d.error || undefined : undefined;

/**
 * An admin form that saves itself (P18.5). Put plain uncontrolled inputs inside
 * (`defaultChecked` / `defaultValue`) and no submit button:
 *
 * - a checkbox, radio or select change posts the whole form at once;
 * - a text field posts on blur (only when changed) and on Enter, never per keystroke;
 * - the toast (`useActionToast`) is the only thing that reports: "Saved." or the error
 *   text from `errorMessage(code)`. This component adds no live region of its own;
 * - when the action refuses (`{ error }`), the form is reset, so every control jumps
 *   back to the saved value. After the revalidation the `default…` values *are* the
 *   saved values, and nothing here is keyed on them, so focus stays where it was.
 *
 * Each post carries the full state of its own form, so with quick successive clicks
 * the last one wins. The route's `action` is used as is (`intent` + `hidden` fields).
 */
export function AutoSaveForm({
  intent,
  hidden,
  errorMessage,
  onReset,
  className,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  intent: string;
  hidden?: Record<string, string>;
  /** Localized text for an error code from the action; `undefined` = generic error. */
  errorMessage?: (code: string | true) => string | undefined;
  /** Called when the form is reset after a refusal (sync any mirrored React state). */
  onReset?: () => void;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const t = useT();
  const fetcher = useFetcher<ActionResult>();
  const formRef = useRef<HTMLFormElement>(null);
  // Last value posted per text control, so Enter followed by blur saves once.
  const sent = useRef(new WeakMap<Element, string>());
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const submit = useCallback(() => {
    // After a microtask, so state set by a child's own onChange (e.g. enabling
    // checkboxes after a radio switch) is in the DOM before the form is read.
    queueMicrotask(() => {
      const form = formRef.current;
      if (!form) return;
      for (const el of Array.from(form.elements)) {
        if (isTextControl(el)) sent.current.set(el, el.value);
      }
      void fetcherRef.current.submit(form, { method: "post" });
    });
  }, []);

  useActionToast(fetcher.data, (d) => {
    const code = errorOf(d);
    return code
      ? { variant: "error", message: errorMessage?.(code) ?? t.error.generic }
      : { variant: "success", message: t.admin.console.saved };
  });

  // A refusal: spring back to the saved values once the request has settled.
  const revertedFor = useRef<unknown>(null);
  useEffect(() => {
    const d = fetcher.data;
    if (fetcher.state !== "idle" || !errorOf(d) || revertedFor.current === d) return;
    revertedFor.current = d;
    sent.current = new WeakMap();
    const form = formRef.current;
    form?.reset();
    // Not every DOM restores a select on reset; put each back on its saved option.
    for (const el of Array.from(form?.elements ?? [])) {
      if (!(el instanceof HTMLSelectElement)) continue;
      const saved = Array.from(el.options).find((o) => o.defaultSelected);
      if (saved) el.value = saved.value;
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <fetcher.Form
      method="post"
      ref={formRef}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={className}
      onReset={onReset}
      onChange={(e) => {
        if (isChoiceControl(e.target)) submit();
      }}
      onBlur={(e) => {
        const el = e.target;
        if (isTextControl(el) && el.value !== el.defaultValue && el.value !== sent.current.get(el))
          submit();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input type="hidden" name="intent" value={intent} />
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
    </fetcher.Form>
  );
}
