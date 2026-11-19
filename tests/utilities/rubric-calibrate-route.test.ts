import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { flatRoutes } from "../helpers/routes";
import { sampleRubric } from "./fixtures";
import { C1, sampleDossier } from "../portfolio/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let rubrics: typeof import("~/server/repositories/rubrics.server");
let shares: typeof import("~/server/repositories/shares.server");
let page: typeof import("~/routes/utilities.rubric.$id.calibrate");
let portfolio: typeof import("~/server/repositories/portfolio.server");
let lib: typeof import("~/lib/utilities/rubric");
let team = "";

beforeAll(async () => {
  rubrics = await import("~/server/repositories/rubrics.server");
  shares = await import("~/server/repositories/shares.server");
  page = await import("~/routes/utilities.rubric.$id.calibrate");
  portfolio = await import("~/server/repositories/portfolio.server");
  lib = await import("~/lib/utilities/rubric");
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
});

describe("calibration as BKE evidence (P34.3)", () => {
  const CODES = ["A1-Jan", "B2-Fatima"];

  /** The summary the browser posts: two works, scored the same except one level on Analyse. */
  function summaryFor(data: import("~/lib/utilities/rubric").RubricData) {
    const [c1, c2] = data.criteria;
    const w = (code: string, l1: number, l2: number) => ({
      code,
      choice: { [c1!.id]: c1!.levels[l1]!.id, [c2!.id]: c2!.levels[l2]!.id },
    });
    const result = lib.calibrate(
      data,
      [w(CODES[0]!, 2, 1), w(CODES[1]!, 1, 1)],
      [w(CODES[0]!, 2, 1), w(CODES[1]!, 2, 1)],
    );
    return JSON.stringify(lib.calibrationSummary(result));
  }

  function act(id: string, fields: Record<string, string | string[]>) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(fields))
      for (const value of [v].flat()) body.append(k, value);
    return page.action({
      request: signedRequest(`http://localhost/utilities/rubric/${id}/calibrate`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
        body: body.toString(),
      }),
      params: { id },
    } as never) as Promise<{ ok: boolean; intent?: string; error?: string }>;
  }

  it("offers the caller's own dossiers and today's date", async () => {
    const r = await rubrics.createRubric("cal-a", "Eindwerk", sampleRubric());
    await portfolio.createDossier("cal-a", "Mijn BKE", sampleDossier());
    await portfolio.createDossier("cal-c", "Hun BKE", sampleDossier());
    const data = (await load(r.id)) as unknown as {
      dossiers: { name: string }[];
      today: string;
    };
    expect(data.dossiers.map((d) => d.name)).toEqual(["Mijn BKE"]);
    expect(data.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("adds the summary as text evidence, linked to the ticked criterion, without codes", async () => {
    const data = sampleRubric();
    const r = await rubrics.createRubric("cal-a", "Eindwerk", data);
    const d = await portfolio.createDossier("cal-a", "BKE", sampleDossier());
    const before = (await rubrics.getRubric("cal-a", r.id))?.data;
    const res = await act(r.id, {
      intent: "use-as-evidence",
      dossierId: d.id,
      criterionIds: [C1],
      summary: summaryFor(data),
    });
    expect(res).toEqual({ ok: true, intent: "use-as-evidence" });
    const evidence = (await portfolio.getDossier("cal-a", d.id))!.data.evidence;
    const added = evidence.at(-1)!;
    expect(evidence).toHaveLength(2);
    expect(added.title).toBe("Kalibreren met een collega: Eindwerk");
    expect(added.kind).toBe("analysis");
    expect(added.criterionIds).toEqual([C1]);
    expect(added.text).toContain("met een collega");
    expect(added.text).toMatch(/\| Analyse \| 1 van 2 \(50%\) \|/);
    for (const code of CODES) expect(added.text).not.toContain(code);
    // The rubric itself is never written.
    expect((await rubrics.getRubric("cal-a", r.id))?.data).toEqual(before);
  });

  it("also works with a rubric shared with your team", async () => {
    const data = sampleRubric();
    const r = await rubrics.createRubric("cal-a", "Gedeeld", data);
    await shares.shareItem("cal-a", "rubric", r.id, team);
    await signInAs({ id: "cal-b" });
    const d = await portfolio.createDossier("cal-b", "BKE", sampleDossier());
    const res = await act(r.id, {
      intent: "use-as-evidence",
      dossierId: d.id,
      summary: summaryFor(data),
    });
    expect(res.ok).toBe(true);
    expect((await portfolio.getDossier("cal-b", d.id))!.data.evidence).toHaveLength(2);
  });

  it("cannot reach someone else's dossier: a 404, and nothing is written", async () => {
    const data = sampleRubric();
    const r = await rubrics.createRubric("cal-a", "Eindwerk", data);
    const theirs = await portfolio.createDossier("cal-c", "Hun BKE", sampleDossier());
    expect(
      await status(
        act(r.id, { intent: "use-as-evidence", dossierId: theirs.id, summary: summaryFor(data) }),
      ),
    ).toBe(404);
    expect((await portfolio.getDossier("cal-c", theirs.id))!.data.evidence).toHaveLength(1);
  });

  it("is a 404 for a rubric you may not see", async () => {
    const data = sampleRubric();
    const r = await rubrics.createRubric("cal-c", "Privé", data);
    const d = await portfolio.createDossier("cal-a", "BKE", sampleDossier());
    expect(
      await status(
        act(r.id, { intent: "use-as-evidence", dossierId: d.id, summary: summaryFor(data) }),
      ),
    ).toBe(404);
    expect((await portfolio.getDossier("cal-a", d.id))!.data.evidence).toHaveLength(1);
  });

  it("refuses a criterion outside the dossier and a summary that does not parse", async () => {
    const data = sampleRubric();
    const r = await rubrics.createRubric("cal-a", "Eindwerk", data);
    const d = await portfolio.createDossier("cal-a", "BKE", sampleDossier());
    const wrongCriterion = await act(r.id, {
      intent: "use-as-evidence",
      dossierId: d.id,
      criterionIds: ["00000000-0000-4000-8000-0000000000ff"],
      summary: summaryFor(data),
    });
    expect(wrongCriterion).toMatchObject({
      ok: false,
      error: "Dat criterium staat niet in dit dossier.",
    });
    for (const summary of ["{nope", JSON.stringify({ works: 1, criteria: [{ id: "A1 Jan" }] })]) {
      const res = await act(r.id, { intent: "use-as-evidence", dossierId: d.id, summary });
      expect(res.ok).toBe(false);
    }
    expect((await portfolio.getDossier("cal-a", d.id))!.data.evidence).toHaveLength(1);
  });
});
