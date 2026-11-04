import { beforeAll, describe, expect, it } from "vitest";
import { sampleRubric } from "../utilities/fixtures";
import { sql } from "drizzle-orm";
import { toScore, type RubricData } from "~/lib/utilities/rubric";

process.env.DATABASE_URL = "file::memory:";

let rubricsRepo: typeof import("~/server/repositories/rubrics.server");
let repo: typeof import("~/server/repositories/rubricScores.server");
let users: typeof import("~/server/repositories/users.server");
let db: typeof import("~/server/db.server");

beforeAll(async () => {
  rubricsRepo = await import("~/server/repositories/rubrics.server");
  repo = await import("~/server/repositories/rubricScores.server");
  users = await import("~/server/repositories/users.server");
  db = await import("~/server/db.server");
});

const full = (d: RubricData, a: number, b: number) =>
  toScore(d, {
    [d.criteria[0].id]: d.criteria[0].levels[a].id,
    [d.criteria[1].id]: d.criteria[1].levels[b].id,
  })!;

describe("rubric scores repository", () => {
  it("stores closed fill-ins with only the month and the levels", async () => {
    const r = await rubricsRepo.createRubric("s-a", "Verslag", sampleRubric());
    const n = await repo.addRubricScores(
      "s-a",
      r.id,
      [full(r.data, 0, 0), full(r.data, 2, 1)],
      new Date("2026-11-04T12:00:00Z"),
    );
    expect(n).toBe(2);
    const scores = await repo.listRubricScores("s-a", r.id);
    expect(scores).toHaveLength(2);
    expect(scores.map((s) => s.month)).toEqual(["2026-11", "2026-11"]);
    expect(scores.map((s) => s.levels)).toEqual(
      expect.arrayContaining([full(r.data, 0, 0), full(r.data, 2, 1)]),
    );
  });

  it("has no column for a name, a code, a comment or a date per fill-in", () => {
    const cols = db
      .getDb()
      .all<{ name: string }>(sql`PRAGMA table_info(rubric_scores)`)
      .map((c) => c.name)
      .sort();
    expect(cols).toEqual(["id", "levels_json", "month", "rubric_id", "user_id"]);
  });

  it("refuses extra keys, unknown ids and incomplete fill-ins, and writes nothing", async () => {
    const r = await rubricsRepo.createRubric("s-b", "Toets", sampleRubric());
    const ok = full(r.data, 1, 1);
    const bad: unknown[] = [
      [{ ...ok[0], name: "Sam" }, ok[1]],
      [{ ...ok[0], code: 3 }, ok[1]],
      [{ ...ok[0], comment: "x" }, ok[1]],
      [ok[0]],
      [ok[0], { criterionId: ok[1].criterionId, levelId: ok[0].levelId }],
      [ok[0], ok[0]],
    ];
    for (const score of bad) {
      await expect(repo.addRubricScores("s-b", r.id, [ok, score])).rejects.toThrow();
    }
    await expect(repo.addRubricScores("s-b", r.id, [])).rejects.toThrow();
    expect(await repo.listRubricScores("s-b", r.id)).toEqual([]);
  });

  it("scopes to the owner of the rubric", async () => {
    const r = await rubricsRepo.createRubric("s-owner", "Privé", sampleRubric());
    expect(await repo.addRubricScores("s-intruder", r.id, [full(r.data, 0, 0)])).toBeNull();
    await repo.addRubricScores("s-owner", r.id, [full(r.data, 0, 0)]);
    expect(await repo.listRubricScores("s-intruder", r.id)).toEqual([]);
    expect(await repo.listRubricScores("s-owner", r.id)).toHaveLength(1);
  });

  it("caps the list", async () => {
    const r = await rubricsRepo.createRubric("s-cap", "Veel", sampleRubric());
    await repo.addRubricScores(
      "s-cap",
      r.id,
      Array.from({ length: 3 }, () => full(r.data, 0, 0)),
    );
    expect(await repo.listRubricScores("s-cap", r.id, 2)).toHaveLength(2);
  });

  it("is removed with the rubric and by deleteUserCascade", async () => {
    const r = await rubricsRepo.createRubric("s-del", "Weg", sampleRubric());
    await repo.addRubricScores("s-del", r.id, [full(r.data, 0, 0)]);
    await rubricsRepo.deleteRubric("s-del", r.id);
    expect(await repo.listRubricScores("s-del", r.id)).toEqual([]);
    const count = () =>
      db
        .getDb()
        .get<{ n: number }>(sql`SELECT count(*) AS n FROM rubric_scores WHERE user_id = ${"s-del"}`)
        ?.n;
    expect(count()).toBe(0);

    const r2 = await rubricsRepo.createRubric("s-del", "Weg 2", sampleRubric());
    await repo.addRubricScores("s-del", r2.id, [full(r2.data, 0, 0)]);
    expect(count()).toBe(1);
    await users.deleteUserCascade("s-del");
    expect(count()).toBe(0);
  });
});
