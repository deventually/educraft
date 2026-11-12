import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let detail: typeof import("~/routes/tracks.$id");
let repo: typeof import("~/server/repositories/tracks.server");
let rubrics: typeof import("~/server/repositories/rubrics.server");

const A = "sa-a";
const B = "sa-b";

beforeAll(async () => {
  detail = await import("~/routes/tracks.$id");
  repo = await import("~/server/repositories/tracks.server");
  rubrics = await import("~/server/repositories/rubrics.server");
  await signInAs({ id: B });
});

beforeEach(() => signInAs({ id: A }));

function post(id: string, fields: Record<string, string>) {
  return detail.action({
    request: signedRequest(`http://localhost/tracks/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
      body: new URLSearchParams(fields).toString(),
    }),
    params: { id },
  } as never) as Promise<{ ok: boolean; intent?: string; error?: string }>;
}

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const levels = (base: number) => [
  { id: id(base + 1), label: "Onvoldoende", points: 1, description: "" },
  { id: id(base + 2), label: "Voldoende", points: 2, description: "" },
  { id: id(base + 3), label: "Goed", points: 3, description: "" },
];
const DATA = {
  criteria: [
    { id: id(1), title: "Analyse", levels: levels(10) },
    { id: id(2), title: "Advies", levels: levels(20) },
  ],
};
const scores = {
  [`a:${id(1)}`]: id(12),
  [`b:${id(1)}`]: id(13),
  [`a:${id(2)}`]: id(23),
  [`b:${id(2)}`]: id(23),
};

describe("the second assessor on a track (P38.5)", () => {
  it("compares both scores on an own rubric and keeps only the outcome as a round", async () => {
    const t = (await repo.createTrack(A, { code: "S-2", kind: "internship" }))!;
    const r = await rubrics.createRubric(A, "Stage", DATA);
    const res = await post(t.id, { intent: "second-assessor", rubricId: r.id, ...scores });
    expect(res).toMatchObject({ ok: true, intent: "second-assessor" });
    const rounds = await repo.listRounds(A, t.id);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({ milestone: "second-assessor", redactedText: "" });
    expect(rounds[0]?.feedback.text).toContain("| Analyse | Voldoende | Goed |");
  });

  it("refuses a colleague's rubric, an incomplete score and a closed track", async () => {
    const t = (await repo.createTrack(A, { code: "S-3", kind: "internship" }))!;
    const theirs = await rubrics.createRubric(B, "Van B", DATA);
    expect(
      await post(t.id, { intent: "second-assessor", rubricId: theirs.id, ...scores }),
    ).toMatchObject({
      ok: false,
      intent: "second-assessor",
    });
    const own = await rubrics.createRubric(A, "Stage", DATA);
    const { [`b:${id(2)}`]: _gone, ...partial } = scores;
    expect(
      await post(t.id, { intent: "second-assessor", rubricId: own.id, ...partial }),
    ).toMatchObject({
      ok: false,
    });
    await repo.closeTrack(A, t.id, new Date());
    expect(
      await post(t.id, { intent: "second-assessor", rubricId: own.id, ...scores }),
    ).toMatchObject({
      ok: false,
    });
    expect(await repo.listRounds(A, t.id)).toEqual([]);
  });
});
