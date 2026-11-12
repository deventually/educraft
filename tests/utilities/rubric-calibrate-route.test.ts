import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { flatRoutes } from "../helpers/routes";
import { sampleRubric } from "./fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let rubrics: typeof import("~/server/repositories/rubrics.server");
let shares: typeof import("~/server/repositories/shares.server");
let page: typeof import("~/routes/utilities.rubric.$id.calibrate");
let team = "";

beforeAll(async () => {
  rubrics = await import("~/server/repositories/rubrics.server");
  shares = await import("~/server/repositories/shares.server");
  page = await import("~/routes/utilities.rubric.$id.calibrate");
  const users = await import("~/server/repositories/users.server");
  const teams = await import("~/server/repositories/teams.server");
  for (const id of ["cal-a", "cal-b", "cal-c"])
    await users.createUser({ id, name: id, passwordHash: "x", role: "teacher" });
  team = (await teams.createTeam("Kalibreren")).id;
  await teams.addMember(team, "cal-a");
  await teams.addMember(team, "cal-b");
});

beforeEach(() => signInAs({ id: "cal-a" }));

const load = (id: string) =>
  page.loader({
    request: signedRequest(`http://localhost/utilities/rubric/${id}/calibrate`),
    params: { id },
  } as never) as Promise<{ rubric: { id: string; name: string }; shared: boolean }>;

async function status(p: Promise<unknown>): Promise<number | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}

describe("utilities/rubric/:id/calibrate", () => {
  it("is registered before utilities/:slug", () => {
    const paths = flatRoutes().map((r) => r.path);
    const at = paths.indexOf("/utilities/rubric/:id/calibrate");
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(paths.indexOf("/utilities/:slug"));
  });

  it("loads the owner's own rubric", async () => {
    const r = await rubrics.createRubric("cal-a", "Eindwerk", sampleRubric());
    const data = await load(r.id);
    expect(data.rubric.name).toBe("Eindwerk");
    expect(data.shared).toBe(false);
  });

  it("loads a rubric shared with your team, read only", async () => {
    const r = await rubrics.createRubric("cal-a", "Stageverslag", sampleRubric());
    await shares.shareItem("cal-a", "rubric", r.id, team);
    await signInAs({ id: "cal-b" });
    const data = await load(r.id);
    expect(data.rubric.name).toBe("Stageverslag");
    expect(data.shared).toBe(true);
  });

  it("is a 404 for someone else's rubric that is not shared with you", async () => {
    const r = await rubrics.createRubric("cal-a", "Privé", sampleRubric());
    await signInAs({ id: "cal-c" });
    expect(await status(load(r.id))).toBe(404);
    expect(await status(load("does-not-exist"))).toBe(404);
  });

  it("has no action: calibrating writes nothing", () => {
    expect("action" in page).toBe(false);
  });
});
