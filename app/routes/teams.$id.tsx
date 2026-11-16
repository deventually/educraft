import { Form, useActionData } from "react-router";
import { Trash2 } from "lucide-react";
import type { Route } from "./+types/teams.$id";
import { loadTeamPage, teamPageAction } from "~/server/teamPage.server";
import { TeamProgrammes } from "~/components/teams/TeamProgrammes";
import { TeamMembers } from "~/components/teams/TeamMembers";
import { TeamBelongsForm } from "~/components/teams/TeamBelongsForm";
import { useT } from "~/lib/i18n/useT";
import { useFormToast } from "~/components/Toast";
import { Button, Input, Label } from "~/components/ui";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { Breadcrumb } from "~/components/Breadcrumb";
import { fmt } from "~/lib/i18n/format";
import { LinkCard } from "~/components/admin/LinkCard";
import { teamError } from "~/components/teams/teamError";
import { TeamSettingsForm } from "~/components/features/TeamSettingsForm";
import { HelpLink } from "~/components/HelpLink";
import { SlideTemplateCard } from "~/components/export/SlideTemplateCard";

/**
 * The one team page (plan step 5, BESLUIT-2026-11-16-7), for the admin, the team's lead and a
 * plain member, with more or fewer controls per role (`teamPage.server.ts` decides who is
 * what). Everyone sees the members and the programmes; the admin and the lead add and remove,
 * and choose parts, tools and models (P28.3); the admin also renames, places the team under a
 * faculty and deletes it; the lead invites, sets the slide template and can step down.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  return loadTeamPage(request, params.id);
}

export async function action({ request, params }: Route.ActionArgs) {
  return teamPageAction(request, params.id);
}

const h2 = "font-display text-lg font-medium tracking-tight text-slate-900";
const card = "mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

export default function TeamPage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const tt = t.teams;
  const { role, team, selfId, candidates, offer, programmes, programmeChoices } = loaderData;
  const actionData = useActionData<typeof action>();
  const errorOf = (code: string | true) =>
    typeof code === "string" ? teamError(t, code) : undefined;

  useFormToast(actionData, {
    result: (d) =>
      !d || "link" in d
        ? null
        : "error" in d && typeof d.error === "string"
          ? { variant: "error", message: teamError(t, d.error) }
          : { variant: "success", message: t.admin.console.saved },
  });

  const intro = { admin: tt.adminTeamIntro, lead: tt.leadIntro, member: tt.memberIntro }[role];

  return (
    <div className="w-full min-w-0 space-y-8">
      <header>
        <Breadcrumb
          label={t.menu.breadcrumb}
          items={[{ label: tt.heading, to: "/teams" }, { label: team.name }]}
        />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
            {team.name}
          </h1>
          {role === "admin" && (
            <ConfirmDialog
              triggerLabel={tt.delete}
              triggerIcon={<Trash2 className="size-3.5" aria-hidden />}
              title={fmt(tt.deleteTitle, { name: team.name })}
              description={tt.deleteBody}
              confirmLabel={tt.deleteConfirm}
              cancelLabel={t.confirm.cancel}
              fields={{ intent: "delete" }}
            />
          )}
        </div>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{intro}</p>
        <HelpLink topic="teams" />
      </header>

      {role === "admin" && (
        <section aria-labelledby="team-details">
          <h2 id="team-details" className={h2}>
            {tt.detailsHeading}
          </h2>
          <div className={`${card} space-y-4`}>
            <AutoSaveForm intent="rename" errorMessage={errorOf} className="max-w-sm">
              <Label htmlFor="team-name">{tt.nameLabel}</Label>
              <Input
                id="team-name"
                name="name"
                type="text"
                defaultValue={team.name}
                maxLength={100}
                className="mt-1"
              />
            </AutoSaveForm>
            <TeamBelongsForm
              belongs={loaderData.belongs}
              divisions={loaderData.divisions}
              divisionId={loaderData.divisionId}
              divisionWord={loaderData.divisionWord}
              errorMessage={errorOf}
            />
          </div>
        </section>
      )}

      <TeamMembers
        role={role}
        team={team}
        selfId={selfId}
        candidates={candidates}
        errorMessage={errorOf}
      />

      <TeamProgrammes
        team={team}
        programmes={programmes}
        choices={programmeChoices}
        canCreate={role === "admin"}
        readOnly={role === "member"}
        headingLevel={2}
      />

      {"settings" in team && offer && (
        <section aria-labelledby="team-features">
          <h2 id="team-features" className={h2}>
            {t.features.teamFeaturesHeading}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{t.features.teamFeaturesIntro}</p>
          <div className={`${card} max-w-xl`}>
            <TeamSettingsForm
              idPrefix="team"
              settings={team.settings}
              offer={offer}
              errorMessage={(code) => (typeof code === "string" ? teamError(t, code) : undefined)}
            />
          </div>
        </section>
      )}

      {role === "lead" && (
        <>
          <section>
            <h2 className={h2}>{tt.inviteHeading}</h2>
            <p className="mt-1 text-sm text-slate-600">{tt.inviteIntro}</p>
            {actionData && "link" in actionData ? (
              <LinkCard
                heading={t.admin.invites.linkHeading}
                hint={t.admin.invites.linkHint}
                url={actionData.link}
                copyLabel={t.admin.invites.copy}
              />
            ) : (
              <Form method="post" className={`${card} max-w-xl space-y-3`}>
                <input type="hidden" name="intent" value="invite" />
                <div>
                  <Label htmlFor="team-invite-note">{t.admin.invites.noteLabel}</Label>
                  <Input
                    id="team-invite-note"
                    name="note"
                    type="text"
                    placeholder={t.admin.invites.notePlaceholder}
                    className="mt-1"
                  />
                </div>
                <Button type="submit" variant="secondary">
                  {tt.inviteSubmit}
                </Button>
              </Form>
            )}
          </section>

          <SlideTemplateCard
            action={`/teams/${team.id}/slide-template`}
            current={loaderData.slideTemplate}
            scope="team"
          />

          <section>
            <ConfirmDialog
              triggerLabel={tt.stepDown}
              triggerVariant="secondary"
              title={tt.stepDownTitle}
              description={tt.stepDownBody}
              confirmLabel={tt.stepDown}
              cancelLabel={t.confirm.cancel}
              fields={{ intent: "stepDown" }}
            />
          </section>
        </>
      )}
    </div>
  );
}
