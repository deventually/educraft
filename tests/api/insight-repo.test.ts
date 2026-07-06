import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type InsightRepo = typeof import("~/server/repositories/insight.server");
type ChatRepo = typeof import("~/server/repositories/chat.server");
type CohortRepo = typeof import("~/server/repositories/cohorts.server");

let insight: InsightRepo;
let chat: ChatRepo;
let cohorts: CohortRepo;

beforeAll(async () => {
  insight = await import("~/server/repositories/insight.server");
  chat = await import("~/server/repositories/chat.server");
  cohorts = await import("~/server/repositories/cohorts.server");
});

const summary = {
  topicsWorkedOn: ["derivatives", "chain rule"],
  skillsProgressed: ["applying the chain rule"],
  misconceptions: ["treats the chain rule as a product rule"],
  effort: "high" as const,
};

describe("insight repository — summaries", () => {
  it("round-trips a saved summary (saveSummary → getSummary)", async () => {
    const saved = await insight.saveSummary({
      sessionId: "sess-round-1",
      userId: "student-1",
      cohortId: "cohort-1",
      toolSlug: "mentorai",
      summary,
      helpfulness: 1,
    });
    expect(saved.id).toBeTruthy();

    const fetched = await insight.getSummary("sess-round-1");
    expect(fetched).not.toBeNull();
    expect(fetched?.toolSlug).toBe("mentorai");
    expect(fetched?.helpfulness).toBe(1);
    expect(JSON.parse(fetched!.summaryJson)).toEqual(summary);
  });

  it("upserts a second close of the same session in place (no duplicate row)", async () => {
    await insight.saveSummary({
      sessionId: "sess-round-2",
      userId: "student-1",
      cohortId: "cohort-1",
      toolSlug: "mentorai",
      summary,
      helpfulness: 0,
    });
    await insight.saveSummary({
      sessionId: "sess-round-2",
      userId: "student-1",
      cohortId: "cohort-1",
      toolSlug: "mentorai",
      summary,
      helpfulness: 1,
    });
    const fetched = await insight.getSummary("sess-round-2");
    expect(fetched?.helpfulness).toBe(1);
  });

  it("listSummariesForCohort returns only the requesting owner's cohort, and never message content", async () => {
    const owner = "teacher-owns";
    const other = "teacher-other";
    const mine = await cohorts.createCohort({
      createdByUserId: owner,
      name: "Mine",
      allowedToolSlugs: ["mentorai"],
    });
    const theirs = await cohorts.createCohort({
      createdByUserId: other,
      name: "Theirs",
      allowedToolSlugs: ["mentorai"],
    });

    await insight.saveSummary({
      sessionId: "sum-mine",
      userId: "s-a",
      cohortId: mine.id,
      toolSlug: "mentorai",
      summary,
      helpfulness: 1,
    });
    await insight.saveSummary({
      sessionId: "sum-theirs",
      userId: "s-b",
      cohortId: theirs.id,
      toolSlug: "mentorai",
      summary,
      helpfulness: -1,
    });

    const rows = await insight.listSummariesForCohort({ id: owner, role: "teacher" }, mine.id);
    expect(rows.map((r) => r.sessionId)).toEqual(["sum-mine"]);
    // The mentor-facing row carries only derived signal — no `content`/`messages` field.
    for (const row of rows) {
      expect(Object.keys(row)).not.toContain("content");
      expect(Object.keys(row)).not.toContain("messages");
    }

    // A non-owner asking for the same cohort gets nothing.
    expect(await insight.listSummariesForCohort({ id: other, role: "teacher" }, mine.id)).toEqual(
      [],
    );
  });

  it("lets an assigned co-teacher and an admin read a cohort's summaries", async () => {
    const owner = "teacher-shares";
    const co = "co-teacher-shares";
    const cohort = await cohorts.createCohort({
      createdByUserId: owner,
      name: "Shared",
      allowedToolSlugs: ["mentorai"],
    });
    await cohorts.addCohortTeacher(cohort.id, co);
    await insight.saveSummary({
      sessionId: "shared-sum",
      userId: "s-shared",
      cohortId: cohort.id,
      toolSlug: "mentorai",
      summary,
      helpfulness: 1,
    });

    // Co-teacher (Phase 4) manages the cohort, so they see its insight too.
    const coRows = await insight.listSummariesForCohort({ id: co, role: "teacher" }, cohort.id);
    expect(coRows.map((r) => r.sessionId)).toEqual(["shared-sum"]);

    // An admin has cohort oversight regardless of authorship.
    const adminRows = await insight.listSummariesForCohort(
      { id: "some-admin", role: "admin" },
      cohort.id,
    );
    expect(adminRows.map((r) => r.sessionId)).toEqual(["shared-sum"]);
  });
});

describe("insight repository — engagement", () => {
  it("derives correct session/turn/last-active counts, scoped to the owner's cohort", async () => {
    const owner = "teacher-eng";
    const cohort = await cohorts.createCohort({
      createdByUserId: owner,
      name: "Engaged",
      allowedToolSlugs: ["mentorai", "socratic-partner"],
    });
    await cohorts.addMembership(cohort.id, "eng-s1");
    await cohorts.addMembership(cohort.id, "eng-s2");

    // Student 1: two mentorai sessions (4 + 2 messages), one socratic session (2).
    await chat.recordChatTurn({
      sessionId: "e-s1-mentor-a",
      userId: "eng-s1",
      cohortId: cohort.id,
      toolSlug: "mentorai",
      model: "claude-sonnet-4-6",
      systemPrompt: "sys",
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
        { role: "user", content: "more" },
        { role: "assistant", content: "sure" },
      ],
    });
    await chat.recordChatTurn({
      sessionId: "e-s1-mentor-b",
      userId: "eng-s1",
      cohortId: cohort.id,
      toolSlug: "mentorai",
      model: "claude-sonnet-4-6",
      systemPrompt: "sys",
      messages: [
        { role: "user", content: "q" },
        { role: "assistant", content: "a" },
      ],
    });
    await chat.recordChatTurn({
      sessionId: "e-s1-socratic",
      userId: "eng-s1",
      cohortId: cohort.id,
      toolSlug: "socratic-partner",
      model: "claude-sonnet-4-6",
      systemPrompt: "sys",
      messages: [
        { role: "user", content: "q" },
        { role: "assistant", content: "a" },
      ],
    });
    // Student 2: one mentorai session (2 messages).
    await chat.recordChatTurn({
      sessionId: "e-s2-mentor",
      userId: "eng-s2",
      cohortId: cohort.id,
      toolSlug: "mentorai",
      model: "claude-sonnet-4-6",
      systemPrompt: "sys",
      messages: [
        { role: "user", content: "q" },
        { role: "assistant", content: "a" },
      ],
    });

    const eng = await cohorts.getCohort(cohort.id); // sanity: cohort exists
    expect(eng).not.toBeNull();

    const c = await insight.cohortEngagement({ id: owner, role: "teacher" }, cohort.id);
    expect(c).not.toBeNull();
    expect(c!.totals.sessions).toBe(4);
    expect(c!.totals.turns).toBe(10); // 4 + 2 + 2 + 2

    const mentor = c!.perTutor.find((t) => t.toolSlug === "mentorai");
    const socratic = c!.perTutor.find((t) => t.toolSlug === "socratic-partner");
    expect(mentor?.sessions).toBe(3);
    expect(mentor?.turns).toBe(8);
    expect(socratic?.sessions).toBe(1);
    expect(socratic?.turns).toBe(2);

    const s1 = c!.perStudent.find((s) => s.userId === "eng-s1");
    const s2 = c!.perStudent.find((s) => s.userId === "eng-s2");
    expect(s1?.sessions).toBe(3);
    expect(s1?.turns).toBe(8);
    expect(s2?.sessions).toBe(1);
    expect(s2?.turns).toBe(2);
    expect(c!.totals.lastActiveAt).toBeInstanceOf(Date);
  });

  it("studentEngagement is scoped to a student in a cohort the requester owns", async () => {
    const owner = "teacher-se";
    const cohort = await cohorts.createCohort({
      createdByUserId: owner,
      name: "SE cohort",
      allowedToolSlugs: ["mentorai"],
    });
    await cohorts.addMembership(cohort.id, "se-student");
    await chat.recordChatTurn({
      sessionId: "se-sess",
      userId: "se-student",
      cohortId: cohort.id,
      toolSlug: "mentorai",
      model: "claude-sonnet-4-6",
      systemPrompt: "sys",
      messages: [
        { role: "user", content: "q" },
        { role: "assistant", content: "a" },
      ],
    });

    const se = await insight.studentEngagement({ id: owner, role: "teacher" }, "se-student");
    expect(se).not.toBeNull();
    expect(se!.totals.sessions).toBe(1);
    expect(se!.totals.turns).toBe(2);
    expect(se!.perTutor[0]?.toolSlug).toBe("mentorai");

    // A co-teacher assigned to that cohort sees the same student engagement.
    await cohorts.addCohortTeacher(cohort.id, "co-se");
    const co = await insight.studentEngagement({ id: "co-se", role: "teacher" }, "se-student");
    expect(co?.totals.sessions).toBe(1);
  });

  it("denies a non-owner: cohortEngagement/studentEngagement/listSummaries return empty", async () => {
    const owner = "teacher-real";
    const intruder = "teacher-intruder";
    const cohort = await cohorts.createCohort({
      createdByUserId: owner,
      name: "Private",
      allowedToolSlugs: ["mentorai"],
    });
    await cohorts.addMembership(cohort.id, "priv-student");
    await chat.recordChatTurn({
      sessionId: "priv-sess",
      userId: "priv-student",
      cohortId: cohort.id,
      toolSlug: "mentorai",
      model: "claude-sonnet-4-6",
      systemPrompt: "sys",
      messages: [
        { role: "user", content: "q" },
        { role: "assistant", content: "a" },
      ],
    });

    const stranger = { id: intruder, role: "teacher" as const };
    expect(await insight.cohortEngagement(stranger, cohort.id)).toBeNull();
    expect(await insight.studentEngagement(stranger, "priv-student")).toBeNull();
    expect(await insight.listSummariesForCohort(stranger, cohort.id)).toEqual([]);
  });
});

describe("privacy: the mentor insight layer exposes no raw-transcript path", () => {
  it("insight.server.ts never selects message content", () => {
    const src = readFileSync(
      resolve(process.cwd(), "app/server/repositories/insight.server.ts"),
      "utf8",
    );
    // Engagement counts turns/last-active from the messages table WITHOUT ever
    // reading the `content` column — so no query can hand a mentor raw chat text.
    expect(src).not.toMatch(/messages\.content/);
    expect(src).not.toMatch(/\.content\b/);
  });

  it("the insight route imports no raw-message reader", () => {
    const src = readFileSync(resolve(process.cwd(), "app/routes/cohorts.$id.insight.tsx"), "utf8");
    expect(src).not.toMatch(/getSessionMessages/);
    expect(src).not.toMatch(/from\s+["']~\/server\/repositories\/chat\.server["']/);
  });
});
