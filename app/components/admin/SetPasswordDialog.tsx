import { useId } from "react";
import { LockKeyhole } from "lucide-react";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { Input, Label } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

/**
 * "Set password" for one user (P18.7, super admin only): a small dialog with the new
 * password twice. It posts `intent=setPassword` to the route action, which hashes it on
 * the server and logs the user out everywhere; the password is never sent back.
 */
export function SetPasswordDialog({ userId, name }: { userId: string; name: string }) {
  const t = useT();
  const uid = useId();
  return (
    <ConfirmDialog
      triggerLabel={t.admin.invites.setPassword}
      triggerIcon={<LockKeyhole className="size-3.5" aria-hidden />}
      triggerVariant="secondary"
      title={fmt(t.admin.invites.setPasswordTitle, { name })}
      description={t.admin.invites.setPasswordBody}
      confirmLabel={t.admin.invites.setPassword}
      confirmVariant="primary"
      cancelLabel={t.confirm.cancel}
      fields={{ intent: "setPassword", userId }}
    >
      <div>
        <Label htmlFor={`${uid}-pw`}>{t.auth.password}</Label>
        <Input
          id={`${uid}-pw`}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="mt-1"
          data-autofocus
        />
      </div>
      <div>
        <Label htmlFor={`${uid}-confirm`}>{t.auth.passwordRepeat}</Label>
        <Input
          id={`${uid}-confirm`}
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="mt-1"
        />
      </div>
    </ConfirmDialog>
  );
}
