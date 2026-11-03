import { useState } from "react";
import { Copy } from "lucide-react";

/** A button that copies `url` to the clipboard and shows a tick once it did. */
export function CopyButton({ url, label }: { url: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(url).then(
          () => setDone(true),
          () => setDone(false),
        );
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      <Copy className="size-3.5" aria-hidden />
      {done ? "✓" : label}
    </button>
  );
}

/**
 * A single-use link the admin copies and passes on out of band (there is no mail
 * service): invite link, password-reset link, and the set-password link of a freshly
 * created account. Persistent content, so it carries no live region of its own.
 */
export function LinkCard({
  heading,
  hint,
  url,
  copyLabel,
}: {
  heading: string;
  hint: string;
  url: string;
  copyLabel: string;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900">{heading}</h3>
      <p className="mt-1 text-sm text-slate-600">{hint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">{url}</span>
        <CopyButton url={url} label={copyLabel} />
      </div>
    </div>
  );
}
