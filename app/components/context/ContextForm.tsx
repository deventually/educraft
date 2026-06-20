/** "Fill it in yourself" — every field on one page. Also serves as the EDIT
 * form: pass a `profile` to pre-fill the fields and submit as an update. Shares
 * its controls and the route action with the wizard; only the layout differs. */
import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { ArrowLeft, Star } from "lucide-react";
import { Button } from "~/components/ui";
import type { ContextProfile } from "~/lib/context/types";
import { defaultPackValues } from "~/lib/context/packs";
import { useT } from "~/lib/i18n/useT";
import {
  NameField,
  ProgrammeField,
  DomainSelect,
  CourseField,
  StudyYearField,
  EqfField,
  ProfessionalContextField,
  ToolsField,
  DomainFields,
  CustomFieldsEditor,
} from "./ContextFields";

export function ContextForm({
  onCancel,
  profile,
  isCurrentDefault = false,
}: {
  onCancel: () => void;
  /** When set, the form edits this profile instead of creating a new one. */
  profile?: ContextProfile;
  /** Whether the edited profile is currently the default (pre-checks the box). */
  isCurrentDefault?: boolean;
}) {
  const t = useT();
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const editing = profile != null;
  const [name, setName] = useState(profile?.name ?? "");
  const [domain, setDomain] = useState(profile?.domain ?? "");
  const [studyYear, setStudyYear] = useState(
    profile?.studyYear != null ? String(profile.studyYear) : "",
  );

  // When creating, pre-fill the pack from the domain's framework (refined by
  // year); when editing, keep the profile's stored answers.
  const packValues = editing
    ? profile.packValues
    : defaultPackValues(domain, studyYear ? Number(studyYear) : undefined);

  return (
    <Form method="post" className="space-y-5">
      {editing && <input type="hidden" name="id" value={profile.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NameField value={name} onChange={setName} />
        <ProgrammeField defaultValue={profile?.programme} />
        <DomainSelect value={domain} onChange={setDomain} />
        <CourseField defaultValue={profile?.courseName} />
        <StudyYearField value={studyYear} onChange={setStudyYear} />
        <EqfField defaultValue={editing ? profile?.eqf : 6} />
      </div>

      <DomainFields key={domain || "none"} domain={domain} values={packValues} />

      <ProfessionalContextField defaultValue={profile?.professionalContext} />
      <ToolsField defaultValue={profile?.tools} />

      <CustomFieldsEditor initial={profile?.customFields} />

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={isCurrentDefault}
          className="size-4 rounded border-slate-300 text-violet-600"
        />
        <Star className="size-4 text-amber-500" aria-hidden /> {t.settings.makeDefault}
      </label>

      <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
        <Button
          type="submit"
          name="intent"
          value={editing ? "update" : "create"}
          disabled={busy || !name.trim()}
        >
          {t.settings.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          <ArrowLeft className="size-4" aria-hidden /> {t.settings.cancel}
        </Button>
      </div>
    </Form>
  );
}
