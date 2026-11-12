import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let detail: typeof import("~/routes/tracks.$id");
let repo: typeof import("~/server/repositories/tracks.server");

const A = "visit-a";

beforeAll(async () => {
  detail = await import("~/routes/tracks.$id");
  repo = await import("~/server/repositories/tracks.server");
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

describe("a visit on a track (P38.6)", () => {
  it("keeps only the date of a visit, once, in order", async () => {
    const t = (await repo.createTrack(A, { code: "S-V", kind: "internship" }))!;
    expect(await post(t.id, { intent: "visit", date: "2027-02-10" })).toMatchObject({
      ok: true,
      intent: "visit",
    });
    await post(t.id, { intent: "visit", date: "2027-01-05" });
    await post(t.id, { intent: "visit", date: "2027-02-10" });
    expect((await repo.getTrack(A, t.id))?.data.visits).toEqual(["2027-01-05", "2027-02-10"]);
    expect(await repo.listRounds(A, t.id)).toEqual([]);
  });

  it("refuses a bad date and a closed track", async () => {
    const t = (await repo.createTrack(A, { code: "S-W", kind: "internship" }))!;
    expect(await post(t.id, { intent: "visit", date: "10-02-2027" })).toMatchObject({ ok: false });
    await repo.closeTrack(A, t.id, new Date());
    expect(await post(t.id, { intent: "visit", date: "2027-02-10" })).toMatchObject({ ok: false });
    expect((await repo.getTrack(A, t.id))?.data.visits).toEqual([]);
  });
});
