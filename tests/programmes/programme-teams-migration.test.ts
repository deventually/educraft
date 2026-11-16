import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const dir = join(process.cwd(), "drizzle");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const run = (db: Database.Database, file: string) => {
  for (const statement of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint"))
    if (statement.trim()) db.exec(statement);
};

describe("migration: a programme keeps its team as its first team (BESLUIT-2026-11-16-1)", () => {
  it("moves programmes.team_id into programme_teams and drops the column", () => {
    const at = files.findIndex((f) =>
      readFileSync(join(dir, f), "utf8").includes("`programme_teams`"),
    );
    expect(at).toBeGreaterThan(0);
    const db = new Database(":memory:");
    for (const f of files.slice(0, at)) run(db, f);
    db.exec(`insert into programmes (id, team_id, created_by, name, sector, created_at, updated_at)
      values ('p1', 't1', 'u1', 'Informatica', 'hbo', 1, 2)`);
    run(db, files[at]!);
    expect(
      db.prepare("select programme_id, team_id, created_at from programme_teams").all(),
    ).toEqual([{ programme_id: "p1", team_id: "t1", created_at: 1 }]);
    const columns = db.prepare("pragma table_info(programmes)").all() as { name: string }[];
    expect(columns.map((c) => c.name)).not.toContain("team_id");
  });
});
