import { useId } from "react";
import { Form } from "react-router";
import { Button, Card } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

/**
 * On a learning line's page, for whoever manages it: the other programmes the line also holds
 * for (voltijd and deeltijd, a line through a faculty), from those whose team they lead.
 */
export function LineProgrammes({
  options,
}: {
  options: { id: string; name: string; linked: boolean }[];
}) {
  const l = useT().programmes.lines;
  const id = useId();
  return (
    <Card className="mt-3 p-4">
      <Form method="post" className="space-y-3">
        <input type="hidden" name="intent" value="programmes" />
        <fieldset aria-describedby={`${id}-hint`}>
          <legend className="text-sm font-medium text-slate-900">{l.linkLegend}</legend>
          <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
            {l.linkHint}
          </p>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {options.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  name="programmeId"
                  value={p.id}
                  defaultChecked={p.linked}
                  className="size-4"
                />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" size="sm" variant="secondary">
          {l.linkSave}
        </Button>
      </Form>
    </Card>
  );
}
