/**
 * Editing a model the admin added, on its card: name, effort, temperature and switches; and
 * removing it, after a second click. The server refuses to remove a model that was used or is
 * still chosen somewhere and says why in the toast. Nothing announces inline.
 */
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Button, Input, Label } from "~/components/ui";
import { ModelSettingsFields } from "~/components/admin/ModelSettingsFields";
import {
  type ModelActionResult,
  type ModelConfig,
  type ModelView,
  useModelToast,
} from "~/components/admin/modelShared";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

function RemoveModel({ model }: { model: ModelView }) {
  const a = useT().modelAdmin;
  const fetcher = useFetcher<ModelActionResult>();
  useModelToast(fetcher.data);
  const [asking, setAsking] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  // Focus follows the step (its first button), but only after a click: never on first render.
  useEffect(() => {
    if (!moved.current) return;
    boxRef.current?.querySelector<HTMLButtonElement>(asking ? "[type=submit]" : "button")?.focus();
  }, [asking]);
  const step = (next: boolean) => {
    moved.current = true;
    setAsking(next);
  };

  return (
    <div ref={boxRef} className="mt-4 border-t border-slate-200 pt-3">
      <p className="text-xs text-slate-500">{a.removeHint}</p>
      {asking ? (
        <fetcher.Form
          method="post"
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={() => setAsking(false)}
        >
          <input type="hidden" name="intent" value="remove" />
          <input type="hidden" name="id" value={model.id} />
          <Button type="submit" variant="danger" size="sm">
            {fmt(a.removeConfirm, { name: model.displayName })}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => step(false)}>
            {a.removeCancel}
          </Button>
        </fetcher.Form>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          disabled={fetcher.state !== "idle"}
          onClick={() => step(true)}
        >
          {a.remove}
        </Button>
      )}
    </div>
  );
}

export function EditModelForm({
  model,
  config,
  idPrefix,
}: {
  model: ModelView;
  config: ModelConfig;
  idPrefix: string;
}) {
  const a = useT().modelAdmin;
  const fetcher = useFetcher<ModelActionResult>();
  useModelToast(fetcher.data);
  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
        {a.edit}
      </summary>
      <fetcher.Form
        method="post"
        aria-label={fmt(a.editLabel, { name: model.displayName })}
        className="mt-3 space-y-4"
      >
        <input type="hidden" name="intent" value="edit" />
        <input type="hidden" name="id" value={model.id} />
        <div>
          <Label htmlFor={`${idPrefix}-edit-name`}>{a.displayName}</Label>
          <Input
            id={`${idPrefix}-edit-name`}
            name="displayName"
            required
            autoComplete="off"
            maxLength={80}
            defaultValue={model.displayName}
            className="mt-1"
          />
        </div>
        <ModelSettingsFields idPrefix={`${idPrefix}-edit`} config={config} />
        <Button type="submit" variant="secondary" disabled={fetcher.state !== "idle"}>
          {a.editSave}
        </Button>
      </fetcher.Form>
      <RemoveModel model={model} />
    </details>
  );
}
