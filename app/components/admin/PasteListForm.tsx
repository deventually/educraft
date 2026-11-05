import { Form } from "react-router";
import { useT } from "~/lib/i18n/useT";
import type { Messages } from "~/lib/i18n/messages/nl";
import type { PasteOutcome, PasteReason } from "~/lib/people/pasteList";
import { Button, Label, Textarea } from "~/components/ui";
import { CopyButton } from "./LinkCard";

/** The text for each reason the server can refuse a pasted line. */
export function reasonText(p: Messages["people"], reason: PasteReason): string {
  const text: Record<PasteReason, string> = {
    invalidEmail: p.reasonInvalidEmail,
    nameRequired: p.reasonNameRequired,
    nameTooLong: p.reasonNameTooLong,
    duplicate: p.reasonDuplicate,
    tooMany: p.reasonTooMany,
    emailTaken: p.reasonEmailTaken,
    alreadyInvited: p.reasonAlreadyInvited,
  };
  return text[reason];
}

const th = "px-3 py-2 font-semibold";

/**
 * "Paste a list" (P28.5): one person per line, everyone their own invite link. The
 * outcome is a table with a link to copy per person, or the reason a line was refused.
 * The count goes through the toast (the page's `useFormToast`); the table is persistent
 * content, so it has no live region of its own.
 */
export function PasteListForm({
  result,
  extraFields,
}: {
  result?: PasteOutcome[];
  /** More fields posted with the list (the team, P28.2). */
  extraFields?: React.ReactNode;
}) {
  const t = useT();
  const p = t.people;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{p.listIntro}</p>
      {result && result.length > 0 && (
        <div className="relative overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <caption className="px-3 py-2 text-left font-semibold text-slate-900">
              {p.listResult}
            </caption>
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className={th}>
                  {p.listColLine}
                </th>
                <th scope="col" className={th}>
                  {p.listColPerson}
                </th>
                <th scope="col" className={th}>
                  {p.listColOutcome}
                </th>
              </tr>
            </thead>
            <tbody>
              {result.map((row) => (
                <tr key={row.line} className="border-b border-slate-50 align-top last:border-0">
                  <td className="px-3 py-2 text-slate-500">{row.line}</td>
                  {"link" in row ? (
                    <>
                      <th scope="row" className="px-3 py-2 text-left font-medium text-slate-800">
                        {row.name}
                        <span className="block font-normal text-slate-600">{row.email}</span>
                      </th>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 break-all font-mono text-xs text-slate-700">
                            {row.link}
                          </span>
                          <CopyButton url={row.link} label={p.copyLink} />
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <th
                        scope="row"
                        className="break-all px-3 py-2 text-left font-normal text-slate-700"
                      >
                        {row.text}
                      </th>
                      <td className="px-3 py-2 text-red-700">{reasonText(p, row.reason)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Form method="post" className="max-w-xl space-y-4">
        <input type="hidden" name="intent" value="mintList" />
        <div>
          <Label htmlFor="list-people">{p.listLabel}</Label>
          <Textarea
            id="list-people"
            name="people"
            rows={6}
            required
            placeholder={p.listPlaceholder}
            className="mt-1 font-mono text-sm"
          />
        </div>
        {extraFields}
        <Button type="submit">{p.listSubmit}</Button>
      </Form>
    </div>
  );
}
