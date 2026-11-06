import * as React from "react";
import { useT } from "~/lib/i18n/useT";
import { cn } from "~/lib/utils";

/**
 * A file picker that looks like the app's secondary button and speaks the
 * interface language, instead of the browser's own "Choose file" control.
 *
 * The native input stays the real control: it keeps the caller's `<Label>`,
 * is the one tab stop (visually hidden, the button-look follows its focus) and
 * works without JS. The chosen file names are its description, ahead of any
 * `aria-describedby` the caller passes.
 */
export const FileInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { id: string }
>(function FileInput({ id, className, onChange, "aria-describedby": describedBy, ...props }, ref) {
  const t = useT().documents;
  const [names, setNames] = React.useState("");
  const statusId = `${id}-chosen`;

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <input
        ref={ref}
        id={id}
        type="file"
        className="peer sr-only"
        aria-describedby={[statusId, describedBy].filter(Boolean).join(" ")}
        onChange={(e) => {
          setNames(Array.from(e.target.files ?? [], (f) => f.name).join(", "));
          onChange?.(e);
        }}
        {...props}
      />
      <label
        htmlFor={id}
        aria-hidden
        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
      >
        {t.chooseFile}
      </label>
      <span id={statusId} className="min-w-0 break-all text-sm text-slate-600">
        {names || t.noFileChosen}
      </span>
    </div>
  );
});
