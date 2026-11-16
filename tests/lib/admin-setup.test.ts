import { describe, it, expect } from "vitest";
import { setupSteps, type SetupFacts } from "~/lib/admin/setup";

// The setup list on the Beheer overview: a lay admin sees in which order to set up the
// institution, what is done, and where to do the next step. Pure: facts in, steps out.

const empty: SetupFacts = {
  kindChosen: false,
  divisions: 0,
  users: 1,
  teams: 0,
  teamsWithoutMembers: 0,
  programmes: 0,
  programmesWithoutDivision: 0,
};

const byId = (facts: SetupFacts) => Object.fromEntries(setupSteps(facts).map((s) => [s.id, s]));

describe("setupSteps", () => {
  it("lists six steps in the order an institution is set up", () => {
    expect(setupSteps(empty).map((s) => s.id)).toEqual([
      "kind",
      "divisions",
      "people",
      "teams",
      "programmes",
      "placement",
    ]);
  });

  it("sends every step to the page where it is done", () => {
    expect(setupSteps(empty).map((s) => s.to)).toEqual([
      "/admin/organisation",
      "/admin/organisation",
      "/admin/users",
      "/admin/teams",
      "/programmes",
      "/admin/organisation",
    ]);
  });

  it("marks the faculty steps optional: an institution may do without them", () => {
    expect(
      setupSteps(empty)
        .filter((s) => s.optional)
        .map((s) => s.id),
    ).toEqual(["kind", "divisions", "placement"]);
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

  it("counts placement as done only when there are faculties and every programme sits under one", () => {
    const placed = { ...empty, divisions: 2, programmes: 3 };
    expect(byId({ ...placed, programmesWithoutDivision: 1 }).placement?.done).toBe(false);
    expect(byId(placed).placement?.done).toBe(true);
    expect(byId({ ...empty, programmes: 3 }).placement?.done).toBe(false);
  });

  it("marks the word, faculties and programmes done when they exist", () => {
    const steps = byId({ ...empty, kindChosen: true, divisions: 1, programmes: 1 });
    expect([steps.kind?.done, steps.divisions?.done, steps.programmes?.done]).toEqual([
      true,
      true,
      true,
    ]);
  });
});
