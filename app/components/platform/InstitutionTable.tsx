import { Form } from "react-router";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { Button, Input, Label } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import type { InstitutionRow } from "./types";

const th = "px-4 py-2.5 font-semibold";
const td = "px-4 py-2.5 text-slate-600";

/**
 * Every institution with its address and status. Deactivating asks first (the address then
 * shows "temporarily unavailable"); removing is offered only for a deactivated institution and
 * needs its id typed, which the server checks again.
 */
export function InstitutionTable({ institutions }: { institutions: InstitutionRow[] }) {
  const t = useT().platform;
  if (institutions.length === 0) return <p className="text-sm text-slate-500">{t.empty}</p>;

  return (
    <div className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{t.listHeading}</caption>
        <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className={th}>
              {t.colName}
            </th>
            <th scope="col" className={th}>
              {t.colId}
            </th>
            <th scope="col" className={th}>
              {t.colHosts}
            </th>
            <th scope="col" className={th}>
              {t.colStatus}
            </th>
            <th scope="col" className={th}>
              {t.colActions}
            </th>
          </tr>
        </thead>
        <tbody>
          {institutions.map((inst) => (
            <tr key={inst.id} className="border-b border-slate-50 last:border-0">
              <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-900">
                {inst.name}
              </th>
              <td className={td}>
                <code className="text-xs">{inst.id}</code>
              </td>
              <td className={td}>
                <span className="break-all">{inst.hosts.join(", ")}</span>
              </td>
              <td className={td}>
                <span
                  className={
                    inst.active
                      ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
                      : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                  }
                >
                  {inst.active ? t.statusActive : t.statusInactive}
                </span>
              </td>
              <td className={td}>
                <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-2 border-0 p-0">
                  <legend className="sr-only">{fmt(t.rowActions, { name: inst.name })}</legend>
                  {inst.active ? (
                    <>
                      <ConfirmDialog
                        triggerLabel={t.deactivate}
                        triggerVariant="secondary"
                        title={fmt(t.deactivateTitle, { name: inst.name })}
                        description={fmt(t.deactivateDescription, { name: inst.name })}
                        confirmLabel={t.deactivateConfirm}
                        cancelLabel={t.cancel}
                        fields={{ intent: "deactivate", id: inst.id }}
                      />
                      <span className="text-xs text-slate-500">{t.removeOnlyInactive}</span>
                    </>
                  ) : (
                    <>
                      <Form method="post">
                        <input type="hidden" name="intent" value="activate" />
                        <input type="hidden" name="id" value={inst.id} />
                        <Button type="submit" size="sm" variant="secondary">
                          {t.activate}
                        </Button>
                      </Form>
                      <ConfirmDialog
                        triggerLabel={t.remove}
                        title={fmt(t.removeTitle, { name: inst.name })}
                        description={fmt(t.removeDescription, { name: inst.name })}
                        confirmLabel={t.removeConfirm}
                        cancelLabel={t.cancel}
                        fields={{ intent: "remove", id: inst.id }}
                      >
                        <div>
                          <Label htmlFor={`remove-confirm-${inst.id}`}>
                            {fmt(t.removeConfirmLabel, { id: inst.id })}
                          </Label>
                          <Input
                            id={`remove-confirm-${inst.id}`}
                            name="confirm"
                            required
                            autoComplete="off"
                            spellCheck={false}
                            className="mt-1"
                            data-autofocus
                          />
                        </div>
                      </ConfirmDialog>
                    </>
                  )}
                </fieldset>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
