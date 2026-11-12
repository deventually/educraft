import { useState } from "react";
import { Form } from "react-router";
import { Plus } from "lucide-react";
import { LinkCard } from "~/components/admin/LinkCard";
import { Button, HelpText, Input, Label } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

/** The link of a freshly added institution, shown once (the server keeps no copy to show). */
export interface AddedInstitution {
  name: string;
  adminName: string;
  setPasswordLink: string;
}

const fields = [
  { name: "id", label: "fieldId", hint: "fieldIdHint", maxLength: 31 },
  { name: "name", label: "fieldName", maxLength: 100 },
  { name: "host", label: "fieldHost", hint: "fieldHostHint", maxLength: 253 },
  { name: "adminName", label: "fieldAdminName", maxLength: 100 },
  { name: "adminEmail", label: "fieldAdminEmail", type: "email", maxLength: 254 },
] as const;

/**
 * "New institution": the platform makes its database and its first admin, then shows the link
 * with which that admin chooses a password. A refusal comes as a toast; the form stays open with
 * what was typed.
 */
export function AddInstitutionForm({ added }: { added: AddedInstitution | null }) {
  const t = useT().platform;
  const [open, setOpen] = useState(false);

  return (
    <section aria-labelledby="platform-add-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="platform-add-heading" className="sr-only">
          {t.addHeading}
        </h3>
        <Button
          type="button"
          aria-expanded={open}
          aria-controls="platform-add"
          onClick={() => setOpen((v) => !v)}
        >
          <Plus className="size-4" aria-hidden />
          {t.newInstitution}
        </Button>
      </div>

      {open && (
        <Form
          id="platform-add"
          method="post"
          aria-label={t.addHeading}
          className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2"
        >
          <input type="hidden" name="intent" value="add" />
          {fields.map((f) => {
            const hintId = "hint" in f ? `platform-${f.name}-hint` : undefined;
            return (
              <div key={f.name}>
                <Label htmlFor={`platform-${f.name}`}>{t[f.label]}</Label>
                <Input
                  id={`platform-${f.name}`}
                  name={f.name}
                  type={"type" in f ? f.type : "text"}
                  required
                  maxLength={f.maxLength}
                  autoComplete="off"
                  aria-describedby={hintId}
                  className="mt-1"
                />
                {"hint" in f && <HelpText id={hintId}>{t[f.hint]}</HelpText>}
              </div>
            );
          })}
          <div className="sm:col-span-2">
            <Button type="submit">{t.add}</Button>
          </div>
        </Form>
      )}

      {added && (
        <LinkCard
          heading={fmt(t.linkHeading, { name: added.name })}
          hint={fmt(t.linkHint, { admin: added.adminName })}
          url={added.setPasswordLink}
          copyLabel={t.copyLink}
        />
      )}
    </section>
  );
}
