import { describe, it, expect, beforeAll } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { sampleRubric } from "../utilities/fixtures";
import { toScore, type RubricData } from "~/lib/utilities/rubric";

process.env.DATABASE_URL = "file::memory:";

const as = (id: string) => signInAs({ id });

let fill: typeof import("~/routes/utilities.rubric.$id.fill");
let page: typeof import("~/routes/utilities.rubric.$id");
let rubrics: typeof import("~/server/repositories/rubrics.server");
let scores: typeof import("~/server/repositories/rubricScores.server");

beforeAll(async () => {
  fill = await import("~/routes/utilities.rubric.$id.fill");
  page = await import("~/routes/utilities.rubric.$id");
  rubrics = await import("~/server/repositories/rubrics.server");
  scores = await import("~/server/repositories/rubricScores.server");
});

const post = (path: string, fields: Record<string, string>) =>
  signedRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });

const full = (d: RubricData, a: number, b: number) =>
  toScore(d, {
    [d.criteria[0]!.id]: d.criteria[0]!.levels[a]!.id,
    [d.criteria[1]!.id]: d.criteria[1]!.levels[b]!.id,
  })!;

const close = (id: string, payload: unknown) =>
  fill.action({
    request: post(`/utilities/rubric/${id}/fill`, {
      intent: "closeBatch",
      scoresJson: JSON.stringify(payload),
    }),
    params: { id },
  } as never);

describe("/utilities/rubric/:id/fill", () => {
  it("loads only the teacher's own rubric", async () => {
    const r = await rubrics.createRubric("f-owner", "Verslag", sampleRubric());
    await as("f-owner");
    const data = (await fill.loader({
      request: signedRequest(`http://localhost/utilities/rubric/${r.id}/fill`),
      params: { id: r.id },
    } as never)) as { rubric: { name: string } };
    expect(data.rubric.name).toBe("Verslag");
    await as("f-intruder");
    await expect(
      fill.loader({
        request: signedRequest(`http://localhost/utilities/rubric/${r.id}/fill`),
        params: { id: r.id },
      } as never),
    ).rejects.toMatchObject({ status: 404 });
    expect(await close(r.id, [full(r.data, 0, 0)])).toEqual({ error: "notFound" });
    expect(await scores.listRubricScores("f-owner", r.id)).toEqual([]);
  });

  it("closing a batch stores the anonymous scores", async () => {
    await as("f-close");
    const r = await rubrics.createRubric("f-close", "Toets", sampleRubric());
    expect(await close(r.id, [full(r.data, 0, 0), full(r.data, 1, 1)])).toEqual({ closed: 2 });
    expect(await scores.listRubricScores("f-close", r.id)).toHaveLength(2);
  });

  it("refuses a payload with a name or junk and stores nothing", async () => {
    await as("f-bad");
    const r = await rubrics.createRubric("f-bad", "Toets", sampleRubric());
    const ok = full(r.data, 0, 0);
    for (const payload of [[[{ ...ok[0], name: "Sam" }, ok[1]]], { name: "Sam" }, []]) {
      expect(await close(r.id, payload)).toEqual({ error: "invalid" });
    }
    const junk = await fill.action({
      request: post(`/utilities/rubric/${r.id}/fill`, { intent: "closeBatch", scoresJson: "{x" }),
      params: { id: r.id },
    } as never);
    expect(junk).toEqual({ error: "invalid" });
    expect(await scores.listRubricScores("f-bad", r.id)).toEqual([]);
  });
});

describe("/utilities/rubric/:id group (P36.1)", () => {
  type Loaded = {
    group: { month: string; total: number } | null;
    rounds: { month: string; count: number }[];
    selected: string;
    scoreCount: number;
    feedbackWith: string | null;
  };
  const load = async (id: string, query = "") =>
    (await page.loader({
      request: signedRequest(`http://localhost/utilities/rubric/${id}${query}`),
      params: { id },
    } as never)) as Loaded;

  it("shows nothing under five closed fill-ins in a round, then the counts", async () => {
    await as("f-insight");
    const r = await rubrics.createRubric("f-insight", "Toets", sampleRubric());
    const nov = new Date("2026-11-12T10:00:00Z");
    await scores.addRubricScores(
      "f-insight",
      r.id,
      Array.from({ length: 4 }, () => full(r.data, 0, 0)),
      nov,
    );
    expect(await load(r.id)).toMatchObject({ group: null, scoreCount: 4, selected: "2026-11" });
    await scores.addRubricScores("f-insight", r.id, [full(r.data, 2, 1)], nov);
    expect((await load(r.id)).group?.total).toBe(5);
  });

  it("opens the newest round, and another one with ?round=", async () => {
    await as("f-rounds");
    const r = await rubrics.createRubric("f-rounds", "Toets", sampleRubric());
    const five = Array.from({ length: 5 }, () => full(r.data, 1, 1));
    await scores.addRubricScores("f-rounds", r.id, five, new Date("2026-09-20T10:00:00Z"));
    await scores.addRubricScores("f-rounds", r.id, five, new Date("2026-11-02T10:00:00Z"));
    const latest = await load(r.id);
    expect(latest.rounds.map((x) => x.month)).toEqual(["2026-11", "2026-09"]);
    expect(latest.group?.month).toBe("2026-11");
    expect((await load(r.id, "?round=2026-09")).group?.month).toBe("2026-09");
    // An unknown round falls back to the newest.
    expect((await load(r.id, "?round=1999-01")).selected).toBe("2026-11");
  });

  it("names the group-feedback tool when it is available to the teacher (P36.2)", async () => {
    await as("f-feedback");
    const r = await rubrics.createRubric("f-feedback", "Toets", sampleRubric());
    expect((await load(r.id)).feedbackWith).toBe("group-feedback");
  });
});
