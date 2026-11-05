import type { ReactNode } from "react";
import { Form } from "react-router";
import { Button } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

/** "Bewerken" (a disclosure with the item's form) and "Verwijderen" for one item. Works without JS. */
export function ItemActions({
  name,
  id,
  removeIntent,
  children,
}: {
  name: string;
  id: string;
  removeIntent: string;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="mt-2 flex flex-wrap items-start gap-2">
      <details className="min-w-0 flex-1 [&[open]>summary]:mb-3">
        <summary className="cursor-pointer text-sm font-medium text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-500">
          {t.courses.edit}
          <span className="sr-only">: {name}</span>
        </summary>
        {children}
      </details>
      <Form method="post">
        <input type="hidden" name="intent" value={removeIntent} />
        <input type="hidden" name="id" value={id} />
        <Button type="submit" size="sm" variant="ghost">
          {t.courses.remove}
          <span className="sr-only">: {name}</span>
        </Button>
      </Form>
    </div>
  );
}
