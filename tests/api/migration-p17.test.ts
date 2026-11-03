// @vitest-environment node
// P17.3 (BESLUIT-2026-11-03-3): the migration that permanently removes student data and the
// cohort/insight schema. Applies the journal up to 0007, seeds a teacher + a student, applies the
// rest, and asserts. This is test code, so it may use better-sqlite3 directly.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

const DRIZZLE = join(process.cwd(), "drizzle");
const journal = JSON.parse(readFileSync(join(DRIZZLE, "meta/_journal.json"), "utf8")) as {
  entries: { tag: string }[];
};
const LAST_OLD = "0007_heavy_morbius";
// The P17.3 migration is this entry. Later entries (P18.7 re-adds users.disabled_at) are
// out of scope here, so the database is built up to and including it only.
const LAST_P17 = "0008_stormy_bloodaxe";

function apply(db: Database.Database, tags: string[]) {
  for (const tag of tags) {
    const sql = readFileSync(join(DRIZZLE, `${tag}.sql`), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      if (stmt.trim()) db.exec(stmt);
    }
  }
}

const tags = journal.entries.map((e) => e.tag);
const cut = tags.indexOf(LAST_OLD) + 1;
const end = tags.indexOf(LAST_P17) + 1;
const NOW = 1_700_000_000_000;

let db: Database.Database;

function seed(db: Database.Database) {
  const run = (sql: string, ...p: unknown[]) => db.prepare(sql).run(...p);
  for (const [id, role, email] of [
    ["t1", "teacher", "t@x.nl"],
    ["s1", "student", "s@x.nl"],
  ]) {
    run(
      "INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)",
      id,
      id,
      email,
      "h",
      role,
      NOW,
    );
    run(
      "INSERT INTO projects (id,user_id,name,created_at) VALUES (?,?,?,?)",
      `p-${id}`,
      id,
      "p",
      NOW,
    );
    run(
      "INSERT INTO generations (id,user_id,tool_slug,model,input_json,output_markdown,created_at) VALUES (?,?,?,?,?,?,?)",
      `g-${id}`,
      id,
      "x",
      "m",
      "{}",
      "o",
      NOW,
    );
    run(
      "INSERT INTO context_profiles (id,user_id,name,data_json,created_at) VALUES (?,?,?,?,?)",
      `c-${id}`,
      id,
      "n",
      "{}",
      NOW,
    );
    run("INSERT INTO usage (id,user_id,day) VALUES (?,?,?)", `u-${id}`, id, "2026-01-01");
    run(
      "INSERT INTO feedback (id,generation_id,user_id,rating,created_at) VALUES (?,?,?,?,?)",
      `f-${id}`,
      `g-${id}`,
      id,
      1,
      NOW,
    );
    run(
      "INSERT INTO chat_sessions (id,tool_slug,system_prompt,model,user_id,cohort_id,created_at) VALUES (?,?,?,?,?,?,?)",
      `cs-${id}`,
      "x",
      "s",
      "m",
      id,
      id === "s1" ? "co1" : null,
      NOW,
    );
    run(
      "INSERT INTO messages (id,session_id,role,content,created_at) VALUES (?,?,?,?,?)",
      `m-${id}`,
      `cs-${id}`,
      "user",
      "hi",
      NOW,
    );
    run(
      "INSERT INTO password_resets (token,user_id,expires_at,created_at) VALUES (?,?,?,?)",
      `pr-${id}`,
      id,
      NOW,
      NOW,
    );
    run(
      "INSERT INTO instance_settings (key,value_json,updated_at) VALUES (?,?,?)",
      `assignedModels:${id}`,
      "[]",
      NOW,
    );
  }
  run(
    "INSERT INTO cohorts (id,created_by_user_id,name,allowed_tool_slugs,created_at) VALUES (?,?,?,?,?)",
    "co1",
    "t1",
    "c",
    "[]",
    NOW,
  );
  run(
    "INSERT INTO cohort_memberships (id,cohort_id,user_id,created_at) VALUES (?,?,?,?)",
    "cm1",
    "co1",
    "s1",
    NOW,
  );
  run(
    "INSERT INTO cohort_teachers (id,cohort_id,user_id,created_at) VALUES (?,?,?,?)",
    "ct1",
    "co1",
    "t1",
    NOW,
  );
  run(
    "INSERT INTO session_summaries (id,session_id,user_id,tool_slug,summary_json,created_at) VALUES (?,?,?,?,?,?)",
    "ss1",
    "cs-s1",
    "s1",
    "x",
    "{}",
    NOW,
  );
  run(
    "INSERT INTO invites (token,role,created_by_user_id,created_at) VALUES (?,?,?,?)",
    "inv-teacher-open",
    "teacher",
    "t1",
    NOW,
  );
  run(
    "INSERT INTO invites (token,role,used_by_user_id,created_by_user_id,created_at) VALUES (?,?,?,?,?)",
    "inv-student-used",
    "student",
    "s1",
    "t1",
    NOW,
  );
  run(
    "INSERT INTO invites (token,role,cohort_id,created_by_user_id,created_at) VALUES (?,?,?,?,?)",
    "inv-cohort-open",
    "student",
    "co1",
    "t1",
    NOW,
  );
}

beforeAll(() => {
  db = new Database(":memory:");
  apply(db, tags.slice(0, cut));
  seed(db);
  apply(db, tags.slice(cut, end));
});

const count = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as { n: number }).n;
const cols = (t: string) =>
  (db.pragma(`table_info(${t})`) as { name: string }[]).map((c) => c.name);

describe("P17.3 migration", () => {
  it("has a migration after 0007", () => {
    expect(end).toBeGreaterThan(cut);
  });

  it("removes every student row and nothing of the teacher", () => {
    expect(count("SELECT COUNT(*) n FROM users WHERE role='student'")).toBe(0);
    for (const [t, c] of [
      ["projects", "user_id"],
      ["generations", "user_id"],
      ["context_profiles", "user_id"],
      ["usage", "user_id"],
      ["feedback", "user_id"],
      ["chat_sessions", "user_id"],
      ["password_resets", "user_id"],
    ]) {
      expect(count(`SELECT COUNT(*) n FROM ${t} WHERE ${c}='s1'`), t).toBe(0);
      expect(count(`SELECT COUNT(*) n FROM ${t} WHERE ${c}='t1'`), t).toBe(1);
    }
    expect(count("SELECT COUNT(*) n FROM users WHERE id='t1'")).toBe(1);
    expect(count("SELECT COUNT(*) n FROM messages WHERE session_id='cs-s1'")).toBe(0);
    expect(count("SELECT COUNT(*) n FROM messages WHERE session_id='cs-t1'")).toBe(1);
    expect(count("SELECT COUNT(*) n FROM instance_settings WHERE key='assignedModels:s1'")).toBe(0);
    expect(count("SELECT COUNT(*) n FROM instance_settings WHERE key='assignedModels:t1'")).toBe(1);
    expect(
      count("SELECT COUNT(*) n FROM invites WHERE role='student' OR used_by_user_id='s1'"),
    ).toBe(0);
  });

  it("drops the cohort and insight tables", () => {
    const names = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((r) => r.name);
    for (const t of ["cohorts", "cohort_memberships", "cohort_teachers", "session_summaries"]) {
      expect(names).not.toContain(t);
    }
  });

  it("drops the student-only columns", () => {
    expect(cols("users")).not.toContain("disabled_at");
    expect(cols("users")).not.toContain("deletion_requested_at");
    expect(cols("invites")).not.toContain("cohort_id");
    expect(cols("invites")).not.toContain("email");
    expect(cols("chat_sessions")).not.toContain("cohort_id");
    expect(cols("tool_settings")).not.toContain("audience_override");
  });

  it("keeps users.session_version", () => {
    expect(cols("users")).toContain("session_version");
  });

  it("keeps the open teacher invite redeemable", () => {
    const row = db
      .prepare("SELECT role, used_by_user_id FROM invites WHERE token='inv-teacher-open'")
      .get() as {
      role: string;
      used_by_user_id: string | null;
    };
    expect(row.role).toBe("teacher");
    expect(row.used_by_user_id).toBeNull();
  });
});
