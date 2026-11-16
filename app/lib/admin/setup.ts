/**
 * The setup list on the Beheer overview: in which order an institution is set up, what is
 * done, and where each step is done. Pure: the overview's loader gathers the facts.
 * The order follows BESLUIT-2026-11-16-4: faculties, programmes under them, people, teams,
 * and the teams linked to their programmes. The faculty steps are optional, because an
 * institution may do without faculties.
 */

export type SetupFacts = {
  /** Whether the word for the layer between institution and programme has been chosen. */
  kindChosen: boolean;
  divisions: number;
  /** Accounts, the admin's own included. */
  users: number;
  teams: number;
  teamsWithoutMembers: number;
  programmes: number;
  programmesWithoutDivision: number;
  programmesWithoutTeam: number;
};

export type SetupStepId = "kind" | "divisions" | "programmes" | "people" | "teams" | "link";

export type SetupStep = { id: SetupStepId; to: string; done: boolean; optional: boolean };

export function setupSteps(f: SetupFacts): SetupStep[] {
  const organisation = "/admin/organisation";
  return [
    { id: "kind", to: organisation, done: f.kindChosen, optional: true },
    { id: "divisions", to: organisation, done: f.divisions > 0, optional: true },
    {
      // With faculties, a programme is made in its faculty on Organisatie.
      id: "programmes",
      to: f.divisions > 0 ? organisation : "/programmes",
      done: f.programmes > 0 && (f.divisions === 0 || f.programmesWithoutDivision === 0),
      optional: false,
    },
    { id: "people", to: "/admin/users", done: f.users > 1, optional: false },
    {
      id: "teams",
      to: "/admin/teams",
      done: f.teams > 0 && f.teamsWithoutMembers === 0,
      optional: false,
    },
    {
      id: "link",
      to: "/admin/teams",
      done: f.programmes > 0 && f.teams > 0 && f.programmesWithoutTeam === 0,
      optional: false,
    },
  ];
}
