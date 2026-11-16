import { useState } from "react";
import { Link } from "react-router";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { HelpText, Label, Select } from "~/components/ui";

type Belongs = "programmes" | "division" | "institution";

const radio =
  "mt-0.5 size-4 border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500";
const link =
  "rounded font-medium text-violet-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

/**
 * "Waar hoort dit team bij?" on the admin's team page (plan step 5): one choice between its
 * programmes, a faculty (or the institution's own word for it) and the whole institution. It
 * saves itself; a faculty is picked from a list that appears with it. A team in programmes
 * belongs to them: the other two wait until the programmes are taken off (Bastiaan,
 * 2026-11-16), so a click never unlinks anything. With no faculties yet, it points to
 * Beheer › Organisatie.
 */
export function TeamBelongsForm({
  belongs,
  divisions,
  divisionId,
  divisionWord,
  errorMessage,
}: {
  belongs: Belongs;
  divisions: { id: string; name: string }[];
  divisionId: string | null;
  divisionWord: string;
  errorMessage: (code: string | true) => string | undefined;
}) {
  const tt = useT().teams;
  const [choice, setChoice] = useState<Belongs>(belongs);
  // A new saved value (a programme linked elsewhere on the page) moves the choice along,
  // without remounting, so focus stays where it is.
  const [saved, setSaved] = useState(belongs);
  if (saved !== belongs) {
    setSaved(belongs);
    setChoice(belongs);
  }
  const kind = divisionWord.toLowerCase();
  const locked = belongs === "programmes";
  const options: { value: Belongs; label: string; hint: string; disabled: boolean }[] = [
    {
      value: "programmes",
      label: tt.belongsProgrammes,
      hint: tt.belongsProgrammesHint,
      disabled: false,
    },
    {
      value: "division",
      label: fmt(tt.belongsDivision, { kind }),
      hint: fmt(tt.belongsDivisionHint, { kind }),
      disabled: locked || divisions.length === 0,
    },
    {
      value: "institution",
      label: tt.belongsInstitution,
      hint: tt.belongsInstitutionHint,
      disabled: locked,
    },
  ];
  return (
    <AutoSaveForm intent="belongs" errorMessage={errorMessage} onReset={() => setChoice(belongs)}>
      <fieldset aria-describedby="team-belongs-note">
        <legend className="text-sm font-medium text-slate-800">{tt.belongsLegend}</legend>
        <div className="mt-2 space-y-2">
          {options.map((o) => (
            <div key={o.value} className="flex items-start gap-2">
              <input
                type="radio"
                id={`team-belongs-${o.value}`}
                name="belongs"
                value={o.value}
                checked={o.value === choice}
                disabled={o.disabled}
                aria-describedby={`team-belongs-${o.value}-hint`}
                onChange={() => setChoice(o.value)}
                className={radio}
              />
              <div>
                <label
                  htmlFor={`team-belongs-${o.value}`}
                  className={`text-sm ${o.disabled ? "text-slate-500" : "text-slate-800"}`}
                >
                  {o.label}
                </label>
                <p id={`team-belongs-${o.value}-hint`} className="text-xs text-slate-500">
                  {o.hint}
                </p>
              </div>
            </div>
          ))}
        </div>
        {choice === "division" && divisions.length > 0 && (
          <div className="mt-3 max-w-sm pl-6">
            <Label htmlFor="team-division">{divisionWord}</Label>
            <Select
              id="team-division"
              name="divisionId"
              defaultValue={divisionId ?? divisions[0]?.id}
              className="mt-1"
            >
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <HelpText id="team-belongs-note">
          {locked ? (
            fmt(tt.belongsLocked, { kind })
          ) : divisions.length === 0 ? (
            <>
              {fmt(tt.divisionNoneYet, { kind })}{" "}
              <Link to="/admin/organisation" className={link}>
                {tt.divisionNoneYetLink}
              </Link>
              .
            </>
          ) : null}
        </HelpText>
      </fieldset>
    </AutoSaveForm>
  );
}
