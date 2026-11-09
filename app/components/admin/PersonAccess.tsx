import { Form } from "react-router";
import { KeyRound, Trash2, UserCheck, UserX } from "lucide-react";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { Button } from "~/components/ui";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { LinkCard } from "~/components/admin/LinkCard";
import { SetPasswordDialog } from "~/components/admin/SetPasswordDialog";

const h2 = "font-display text-lg font-medium tracking-tight text-slate-900";

/**
 * The bottom of one person's page (P28.1): Access (reset link, password, (de)activation)
 * and, apart, Delete. Only shown to an admin who may manage this person.
 */
export function PersonAccess({
  person,
  displayName,
  viewerIsOwner,
  resetLink,
}: {
  person: { id: string; status: "active" | "disabled" };
  displayName: string;
  viewerIsOwner: boolean;
  resetLink?: string;
}) {
  const t = useT();
  const p = t.people;
  const i = t.admin.invites;
  const disabled = person.status === "disabled";
  return (
    <>
      {/* ── Access: reset link, password, (de)activation ───────────────────── */}
      <section>
        <h2 className={h2}>{p.access}</h2>
        {resetLink && (
          <LinkCard
            heading={i.resetLinkHeading}
            hint={i.resetLinkHint}
            url={resetLink}
            copyLabel={i.copy}
          />
        )}
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Form method="post">
              <input type="hidden" name="intent" value="resetPassword" />
              <Button type="submit" variant="secondary" size="sm">
                <KeyRound className="size-3.5" aria-hidden />
                {i.resetPassword}
              </Button>
            </Form>
            {viewerIsOwner && (
              <>
                <SetPasswordDialog userId={person.id} name={displayName} />
                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value={disabled ? "reactivate" : "deactivate"}
                  />
                  <Button type="submit" variant="secondary" size="sm">
                    {disabled ? (
                      <UserCheck className="size-3.5" aria-hidden />
                    ) : (
                      <UserX className="size-3.5" aria-hidden />
                    )}
                    {disabled ? i.reactivate : i.deactivate}
                  </Button>
                </Form>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Delete, apart at the bottom ─────────────────────────────────────── */}
      <section>
        <h2 className={h2}>{p.danger}</h2>
        <p className="mt-1 text-sm text-slate-600">{p.dangerIntro}</p>
        <div className="mt-3">
          <ConfirmDialog
            triggerLabel={i.deleteUser}
            triggerIcon={<Trash2 className="size-3.5" aria-hidden />}
            title={i.deleteUserTitle}
            description={i.deleteUserConfirm}
            confirmLabel={i.deleteUser}
            cancelLabel={t.confirm.cancel}
            fields={{ intent: "deleteUser" }}
            typeToConfirm={{
              word: displayName,
              label: fmt(i.deleteUserType, { name: displayName }),
            }}
          />
        </div>
      </section>
    </>
  );
}
