import { describe, it, expect, beforeAll, vi } from "vitest";
import { sampleRubric } from "../utilities/fixtures";
import { toScore, type RubricData } from "~/lib/utilities/rubric";

process.env.DATABASE_URL = "file::memory:";

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ requireUser: requireUserMock }));

const teacher = (id: string) => ({
  id,
  name: id,
  email: null,
  role: "teacher",
  createdAt: new Date(0),
});
const as = (id: string) => requireUserMock.mockResolvedValue(teacher(id));

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
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });

const full = (d: RubricData, a: number, b: number) =>
  toScore(d, {
    [d.criteria[0].id]: d.criteria[0].levels[a].id,
    [d.criteria[1].id]: d.criteria[1].levels[b].id,
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
    as("f-owner");
    const data = (await fill.loader({
      request: new Request(`http://localhost/utilities/rubric/${r.id}/fill`),
      params: { id: r.id },
    } as never)) as { rubric: { name: string } };
    expect(data.rubric.name).toBe("Verslag");
    as("f-intruder");
    await expect(
      fill.loader({
        request: new Request(`http://localhost/utilities/rubric/${r.id}/fill`),
        params: { id: r.id },
      } as never),
    ).rejects.toMatchObject({ status: 404 });
    expect(await close(r.id, [full(r.data, 0, 0)])).toEqual({ error: "notFound" });
    expect(await scores.listRubricScores("f-owner", r.id)).toEqual([]);
  });

  it("closing a batch stores the anonymous scores", async () => {
    as("f-close");
    const r = await rubrics.createRubric("f-close", "Toets", sampleRubric());
    expect(await close(r.id, [full(r.data, 0, 0), full(r.data, 1, 1)])).toEqual({ closed: 2 });
    expect(await scores.listRubricScores("f-close", r.id)).toHaveLength(2);
  });

  it("refuses a payload with a name or junk and stores nothing", async () => {
    as("f-bad");
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

describe("/utilities/rubric/:id insight", () => {
  const load = async (id: string) =>
    (await page.loader({
      request: new Request(`http://localhost/utilities/rubric/${id}`),
      params: { id },
    } as never)) as { insight: { total: number } | null; scoreCount: number };

  it("shows nothing under five closed fill-ins, then a count per level", async () => {
    as("f-insight");
    const r = await rubrics.createRubric("f-insight", "Toets", sampleRubric());
    await scores.addRubricScores(
      "f-insight",
      r.id,
      Array.from({ length: 4 }, () => full(r.data, 0, 0)),
    );
    expect(await load(r.id)).toMatchObject({ insight: null, scoreCount: 4 });
    await scores.addRubricScores("f-insight", r.id, [full(r.data, 2, 1)]);
    expect((await load(r.id)).insight?.total).toBe(5);
  });
});
