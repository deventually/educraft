import { useId, useRef } from "react";
import { useFetcher } from "react-router";
import { Trash2, Upload } from "lucide-react";
import { FileInput } from "~/components/FileInput";
import { useActionToast } from "~/components/Toast";
import { Button, Card } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

type Result =
  | { ok: "saved"; name: string }
  | { ok: "deleted" }
  | { error: "tooLarge" | "notPowerPoint" | "macros" | "noLayout" | "noFile" | "wrongType" };

/**
 * A teacher's own or a team's PowerPoint template (P30.7b): the current one with a remove
 * button, and a file field to upload a new one (it replaces the old). The file goes to
 * `action`, which checks it at the boundary; the result comes back as one toast.
 */
export function SlideTemplateCard({
  action,
  current,
  scope,
}: {
  action: string;
  current: { name: string } | null;
  scope: "own" | "team";
}) {
  const m = useT().exportResult.templates;
  const fetcher = useFetcher<Result>();
  const fieldId = useId();
  const headingId = useId();
  const form = useRef<HTMLFormElement>(null);
  const busy = fetcher.state !== "idle";

  useActionToast(fetcher.data, (d) => {
    if ("error" in d) return { variant: "error", message: m.errors[d.error] };
    if (d.ok === "saved") {
      form.current?.reset();
      return { variant: "success", message: fmt(m.saved, { name: d.name }) };
    }
    return { variant: "success", message: m.deleted };
  });

  return (
    <Card className="mt-6 p-6">
      <section aria-labelledby={headingId}>
        <h2 id={headingId} className="font-semibold text-slate-900">
          {m.heading}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{scope === "own" ? m.introOwn : m.introTeam}</p>
        {current && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-600">{m.current}:</span>
            <span className="font-medium break-all text-slate-900">{current.name}</span>
            <fetcher.Form method="post" action={action} encType="multipart/form-data">
              <input type="hidden" name="intent" value="delete" />
              <Button
                type="submit"
                variant="secondary"
                disabled={busy}
                aria-label={fmt(m.delete, { name: current.name })}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </fetcher.Form>
          </div>
        )}
        <fetcher.Form
          ref={form}
          method="post"
          action={action}
          encType="multipart/form-data"
          className="mt-4 space-y-3"
        >
          <input type="hidden" name="intent" value="upload" />
          <div>
            <label htmlFor={fieldId} className="block text-sm font-medium text-slate-800">
              {m.field}
            </label>
            <FileInput id={fieldId} name="file" accept=".pptx,.potx" required className="mt-1" />
          </div>
          <Button type="submit" variant="secondary" disabled={busy}>
            <Upload className="size-4" aria-hidden />
            {m.upload}
          </Button>
        </fetcher.Form>
      </section>
    </Card>
  );
}
