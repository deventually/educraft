import { useEffect, useRef, useState } from "react";
import { Form } from "react-router";
import { useT } from "~/lib/i18n/useT";
import { Button, Input, Label, Select } from "~/components/ui";
import { ROLES } from "~/lib/registry/access";
import { LinkCard } from "./LinkCard";

/** What the `createAccount` intent returns (the parts this form reads). */
export type CreateAccountResult =
  | {
      setPasswordLink?: string;
      accountCreated?: true;
      error?: string;
    }
  | null
  | undefined;

/**
 * "Create an account" (P18.7, super admin only). The account exists at once; the user
 * gets a password one of two ways: a single-use link to choose one (default; shown as a
 * copyable card — nothing is mailed), or an initial password the admin types, which is
 * hashed on the server and never shown again. The password fields exist only in that
 * mode, so nothing is submitted in the other. On success the form clears itself.
 */
export function CreateAccountForm({
  result,
  errorMessage,
  extraFields,
}: {
  result: CreateAccountResult;
  /** The text for a refused create (the action's error code, already translated). */
  errorMessage?: string;
  /** More fields posted with the account, after the role (e.g. the team, P28.2). */
  extraFields?: React.ReactNode;
}) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<"link" | "password">("link");
  const created = Boolean(result && (result.setPasswordLink || result.accountCreated));

  // A fresh result object per submission: clear the typed values after a success only.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the result object
  useEffect(() => {
    if (!created) return;
    formRef.current?.reset();
    setMode("link");
  }, [result]);

  const i = t.admin.invites;
  return (
    <section>
      <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
        {i.createHeading}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{i.createIntro}</p>

      {result?.setPasswordLink && (
        <LinkCard
          heading={i.setPasswordLinkHeading}
          hint={i.setPasswordLinkHint}
          url={result.setPasswordLink}
          copyLabel={i.copy}
        />
      )}

      {errorMessage && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      )}

      <Form method="post" ref={formRef} className="mt-4 max-w-xl space-y-4">
        <input type="hidden" name="intent" value="createAccount" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="create-name">{i.createName}</Label>
            <Input
              id="create-name"
              name="name"
              type="text"
              autoComplete="off"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="create-email">{i.createEmail}</Label>
            <Input
              id="create-email"
              name="email"
              type="email"
              autoComplete="off"
              required
              className="mt-1"
            />
          </div>
        </div>
        <div className="sm:w-1/2 sm:pr-2">
          <Label htmlFor="create-role">{i.createRole}</Label>
          <Select id="create-role" name="role" defaultValue="teacher" className="mt-1">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r === "admin" ? i.roleAdmin : i.roleTeacher}
              </option>
            ))}
          </Select>
        </div>
        {extraFields}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-800">{i.createModeLegend}</legend>
          {(
            [
              ["link", i.createModeLink],
              ["password", i.createModePassword],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="passwordMode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
                className="size-4 border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
              />
              {label}
            </label>
          ))}
        </fieldset>

        {mode === "password" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="create-password">{i.createPassword}</Label>
              <Input
                id="create-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="create-confirm">{i.createConfirm}</Label>
              <Input
                id="create-confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                className="mt-1"
              />
            </div>
          </div>
        )}

        <Button type="submit">{i.createSubmit}</Button>
      </Form>
    </section>
  );
}
