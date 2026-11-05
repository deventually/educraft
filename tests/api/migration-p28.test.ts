// @vitest-environment node
// P28.3: migration 0016 brings every existing stand over (a tool switched off stays off,
// the BDB/BKE switch per teacher from P27.2 becomes an exception), 0017 drops the old
// boolean column. Applies the journal up to 0015, seeds, applies the rest. Test code, so it
// may use better-sqlite3 directly.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

const DRIZZLE = join(process.cwd(), "drizzle");
const journal = JSON.parse(readFileSync(join(DRIZZLE, "meta/_journal.json"), "utf8")) as {
  entries: { tag: string }[];
};
const tags = journal.entries.map((e) => e.tag);
const cut = tags.indexOf("0015_broken_joystick") + 1;

function apply(db: Database.Database, list: string[]) {
  for (const tag of list) {
    for (const stmt of readFileSync(join(DRIZZLE, `${tag}.sql`), "utf8").split(
      "--> statement-breakpoint",
    )) {
      if (stmt.trim()) db.exec(stmt);
    }
  }
}

let db: Database.Database;
beforeAll(() => {
  db = new Database(":memory:");
  apply(db, tags.slice(0, cut));
  const now = 1_700_000_000_000;
  const tool = db.prepare(
    "INSERT INTO tool_settings (tool_slug, enabled, updated_at) VALUES (?, ?, ?)",
  );
  tool.run("math-grading", 0, now);
  tool.run("mentorai", 1, now);
  tool.run("socratic-partner", null, now);
  const setting = db.prepare(
    "INSERT INTO instance_settings (key, value_json, updated_at) VALUES (?, ?, ?)",
  );
  setting.run("portfolioEnabled:t-on", "true", now);
  setting.run("portfolioEnabled:t-off", "false", now);
  setting.run("assignedModels:t-on", '["claude-haiku-4-5"]', now);
  db.prepare("INSERT INTO teams (id, name, created_at) VALUES ('team-1', 'Oud', ?)").run(now);
  apply(db, tags.slice(cut));
});

describe("migrations 0016-0017 (P28.3)", () => {
  it("turns the tool switch into a stand: off stays off, on stays on, untouched stays default", () => {
    const rows = db.prepare("SELECT tool_slug, stand FROM tool_settings ORDER BY tool_slug").all();
    expect(rows).toEqual([
      { tool_slug: "math-grading", stand: "off" },
      { tool_slug: "mentorai", stand: "on" },
      { tool_slug: "socratic-partner", stand: null },
    ]);
    const cols = db.prepare("PRAGMA table_info(tool_settings)").all() as { name: string }[];
    expect(cols.map((c) => c.name)).not.toContain("enabled");
  });

  it("moves each BDB/BKE switch per teacher to an exception, and keeps the model sets", () => {
    expect(
      db.prepare("SELECT user_id, key, choice FROM feature_exceptions ORDER BY user_id").all(),
    ).toEqual([
      { user_id: "t-off", key: "feature:portfolio", choice: "off" },
      { user_id: "t-on", key: "feature:portfolio", choice: "on" },
    ]);
    const keys = (db.prepare("SELECT key FROM instance_settings").all() as { key: string }[]).map(
      (r) => r.key,
    );
    expect(keys).toEqual(["assignedModels:t-on"]);
  });

  it("gives an existing team empty choices", () => {
    expect(db.prepare("SELECT settings_json FROM teams").get()).toEqual({ settings_json: "{}" });
  });
});
