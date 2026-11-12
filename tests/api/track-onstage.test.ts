import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let detail: typeof import("~/routes/tracks.$id");
let repo: typeof import("~/server/repositories/tracks.server");

const A = "onstage-a";
const B = "onstage-b";

beforeAll(async () => {
  detail = await import("~/routes/tracks.$id");
  repo = await import("~/server/repositories/tracks.server");
});

beforeEach(async () => {
  await signInAs({ id: A });
});

function post(id: string, fields: [string, string][]) {
  return detail.action({
    request: signedRequest(`http://localhost/tracks/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
      body: new URLSearchParams(fields).toString(),
    }),
    params: { id },
  } as never) as Promise<{ ok: boolean; intent?: string; error?: string }>;
}

describe("Ready for OnStage (P38.7)", () => {
  it("keeps the confirmed text per criterion, in order", async () => {
    const t = (await repo.createTrack(A, { code: "S-O", kind: "internship" }))!;
    const r = await post(t.id, [
      ["intent", "onstage"],
      ["criterion", "C1 Analyse"],
      ["text", "Sterke analyse."],
      ["criterion", "C2 Aanpak"],
      ["text", ""],
    ]);
    expect(r).toMatchObject({ ok: true, intent: "onstage" });
    expect((await repo.getTrack(A, t.id))?.data.onstage).toEqual([
      { criterion: "C1 Analyse", text: "Sterke analyse." },
      { criterion: "C2 Aanpak", text: "" },
    ]);
  });

  it("refuses unequal fields and a closed track", async () => {
    const t = (await repo.createTrack(A, { code: "S-P", kind: "internship" }))!;
    expect(
      await post(t.id, [
        ["intent", "onstage"],
        ["criterion", "C1"],
      ]),
    ).toMatchObject({ ok: false, intent: "onstage" });
    await repo.closeTrack(A, t.id, new Date());
    expect(
      await post(t.id, [
        ["intent", "onstage"],
        ["criterion", "C1"],
        ["text", "x"],
      ]),
    ).toMatchObject({ ok: false });
    expect((await repo.getTrack(A, t.id))?.data.onstage).toEqual([]);
  });
});

describe("closing a track (P38.7)", () => {
  it("closes the track and sets when it is wiped; a second close is refused", async () => {
    const t = (await repo.createTrack(A, { code: "S-C", kind: "thesis" }))!;
    expect(await post(t.id, [["intent", "close"]])).toMatchObject({ ok: true, intent: "close" });
    const closed = await repo.getTrack(A, t.id);
    expect(closed?.closedAt).toBeInstanceOf(Date);
    expect(closed?.purgeAfter).toBeInstanceOf(Date);
    expect(closed!.purgeAfter!.getTime()).toBeGreaterThan(closed!.closedAt!.getTime());
    expect(await post(t.id, [["intent", "close"]])).toMatchObject({ ok: false, intent: "close" });
  });

  it("another teacher cannot close it", async () => {
    const t = (await repo.createTrack(A, { code: "S-D", kind: "thesis" }))!;
    await signInAs({ id: B });
    await expect(post(t.id, [["intent", "close"]])).rejects.toMatchObject({ status: 404 });
    expect((await repo.getTrack(A, t.id))?.closedAt).toBeNull();
  });
});
