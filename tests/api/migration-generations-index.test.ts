// @vitest-environment node
// P2: `generations.user_id` gets an index. Every repository query on generations is scoped to
// its owner and the history list orders by `created_at`, so the index is (user_id, created_at).
// Applies the whole journal to a fresh DB and asserts the index exists and the query planner uses
// it. This is test code, so it may use better-sqlite3 directly.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

const DRIZZLE = join(process.cwd(), "drizzle");
const journal = JSON.parse(readFileSync(join(DRIZZLE, "meta/_journal.json"), "utf8")) as {
  entries: { tag: string }[];
};

let db: Database.Database;

beforeAll(() => {
  db = new Database(":memory:");
  for (const { tag } of journal.entries) {
    const sql = readFileSync(join(DRIZZLE, `${tag}.sql`), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      if (stmt.trim()) db.exec(stmt);
    }
  }
});

describe("generations user index", () => {
  it("indexes generations on (user_id, created_at)", () => {
    const indexes = db.pragma("index_list(generations)") as { name: string }[];
    const idx = indexes.find((i) => i.name === "generations_user_idx");
    expect(idx).toBeDefined();
    const cols = (db.pragma("index_info(generations_user_idx)") as { name: string }[]).map(
      (c) => c.name,
    );
    expect(cols).toEqual(["user_id", "created_at"]);
  });

  it("is used by the owner-scoped history query", () => {
    const plan = db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT * FROM generations WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      )
      .all("u1") as { detail: string }[];
    const detail = plan.map((p) => p.detail).join("\n");
    expect(detail).toContain("generations_user_idx");
    expect(detail).not.toContain("TEMP B-TREE");
  });
});
