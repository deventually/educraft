import { describe, it, expect } from "vitest";
import { setupSteps, type SetupFacts } from "~/lib/admin/setup";

// The setup list on the Beheer overview: a lay admin sees in which order to set up the
// institution, what is done, and where to do the next step. Pure: facts in, steps out.
// The order follows BESLUIT-2026-11-16-4: faculties, then programmes under them, then
// people and teams, and last the teams linked to their programmes.

const empty: SetupFacts = {
  kindChosen: false,
  divisions: 0,
  users: 1,
  teams: 0,
  teamsWithoutMembers: 0,
  programmes: 0,
  programmesWithoutDivision: 0,
  programmesWithoutTeam: 0,
};

const byId = (facts: SetupFacts) => Object.fromEntries(setupSteps(facts).map((s) => [s.id, s]));

describe("setupSteps", () => {
  it("lists six steps in the order an institution is set up", () => {
    expect(setupSteps(empty).map((s) => s.id)).toEqual([
      "kind",
      "divisions",
      "programmes",
      "people",
      "teams",
      "link",
    ]);
  });

  it("sends every step to the page where it is done", () => {
    expect(setupSteps(empty).map((s) => s.to)).toEqual([
      "/admin/organisation",
      "/admin/organisation",
      "/programmes",
      "/admin/users",
      "/admin/teams",
      "/admin/teams",
    ]);
  });

  it("makes programmes in their faculty once there are faculties", () => {
    expect(byId({ ...empty, divisions: 2 }).programmes?.to).toBe("/admin/organisation");
  });

  it("marks the faculty steps optional: an institution may do without them", () => {
    expect(
      setupSteps(empty)
        .filter((s) => s.optional)
        .map((s) => s.id),
    ).toEqual(["kind", "divisions"]);
  });

  it("has nothing done on a fresh instance with only its admin", () => {
    expect(setupSteps(empty).filter((s) => s.done)).toEqual([]);
  });

  it("counts people as invited once there is someone besides the admin", () => {
    expect(byId({ ...empty, users: 2 }).people?.done).toBe(true);
  });

  it("counts teams as done only when every team has members", () => {
    expect(byId({ ...empty, teams: 2, teamsWithoutMembers: 1 }).teams?.done).toBe(false);
    expect(byId({ ...empty, teams: 2 }).teams?.done).toBe(true);
  });

  it("counts programmes as done when they exist, each under a faculty if there are faculties", () => {
    expect(byId({ ...empty, programmes: 3 }).programmes?.done).toBe(true);
    const placed = { ...empty, divisions: 2, programmes: 3 };
    expect(byId({ ...placed, programmesWithoutDivision: 1 }).programmes?.done).toBe(false);
    expect(byId(placed).programmes?.done).toBe(true);
  });

  it("counts linking as done when every programme has a team", () => {
    const set = { ...empty, programmes: 3, teams: 2 };
    expect(byId({ ...set, programmesWithoutTeam: 1 }).link?.done).toBe(false);
    expect(byId(set).link?.done).toBe(true);
    expect(byId({ ...empty, teams: 2 }).link?.done).toBe(false);
  });

  it("marks the word and the faculties done when they exist", () => {
    const steps = byId({ ...empty, kindChosen: true, divisions: 1 });
    expect([steps.kind?.done, steps.divisions?.done]).toEqual([true, true]);
  });
});
