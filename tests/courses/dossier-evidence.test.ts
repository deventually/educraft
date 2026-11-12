import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { documentedCourse, TEST1 } from "./fixtures";

// The test dossier as BKE evidence (P35.3): a snapshot, only of own or co-owned courses.
process.env.DATABASE_URL = "file::memory:";

let courses: typeof import("~/server/repositories/courses.server");
let portfolio: typeof import("~/server/repositories/portfolio.server");
let generations: typeof import("~/server/repositories/generations.server");
let members: typeof import("~/server/repositories/courseMembers.server");
let evidence: typeof import("~/server/courseEvidence.server");
let detail: typeof import("~/routes/courses.$id");
let fixtures: typeof import("../portfolio/fixtures");

beforeAll(async () => {
  courses = await import("~/server/repositories/courses.server");
  portfolio = await import("~/server/repositories/portfolio.server");
  generations = await import("~/server/repositories/generations.server");
  members = await import("~/server/repositories/courseMembers.server");
  evidence = await import("~/server/courseEvidence.server");
  detail = await import("~/routes/courses.$id");
  fixtures = await import("../portfolio/fixtures");
  const users = await import("~/server/repositories/users.server");
  const teams = await import("~/server/repositories/teams.server");
  const exceptions = await import("~/server/repositories/exceptions.server");
  for (const id of ["dev-a", "dev-b", "dev-c"]) {
    await users.createUser({ id, name: id, passwordHash: "x", role: "teacher" });
    await exceptions.setException(id, exceptions.featureKey("portfolio"), "on");
  }
  const team = (await teams.createTeam("Toetscommissie")).id;
  for (const id of ["dev-a", "dev-b", "dev-c"]) await teams.addMember(team, id);
});

beforeEach(() => signInAs({ id: "dev-a" }));

function post(path: string, fields: Record<string, string | string[]>): Request {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields))
    for (const value of Array.isArray(v) ? v : [v]) body.append(k, value);
  return signedRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: body.toString(),
  });
}

const act = (id: string, fields: Record<string, string | string[]>) =>
  detail.action({ request: post(`/courses/${id}`, fields), params: { id } } as never);

async function setup(userId = "dev-a") {
  const c = await courses.createCourse("dev-a", { name: "Databases", data: documentedCourse() });
  const d = await portfolio.createDossier(userId, "Mijn BKE", fixtures.sampleDossier());
  const g = await generations.saveGeneration({
    userId: "dev-a",
    toolSlug: "test-analysis",
    stageId: "explain",
    model: "m",
    input: { analysis: "| V1 | 0,82 |" },
    outputLanguage: "nl",
    outputMarkdown: "Vraag 1 was goed.",
  });
  await courses.linkGeneration("dev-a", c.id, g.id, TEST1);
  return { c, d };
}

const lastEvidence = async (userId: string, dossierId: string) =>
  (await portfolio.getDossier(userId, dossierId))!.data.evidence.at(-1)!;

describe("the test dossier as BKE evidence (P35.3)", () => {
  it("adds the dossier as a snapshot of test material, with the caller's own analysis", async () => {
    const { c, d } = await setup();
    expect(
      await act(c.id, {
        intent: "use-as-evidence",
        dossierId: d.id,
        part: `dossier:${TEST1}`,
        criterionIds: [fixtures.C1],
      }),
    ).toEqual({ ok: true, intent: "use-as-evidence" });
    const ev = await lastEvidence("dev-a", d.id);
    expect(ev).toMatchObject({
      title: "Databases: toetsdossier Eindopdracht",
      kind: "test-material",
      criterionIds: [fixtures.C1],
      sourceCourse: { courseId: c.id, part: { assessmentId: TEST1, dossier: true } },
    });
    expect(ev.text).toContain("## Nog te doen");
    expect(ev.text).toContain("## Beoordelingsmodel");
    expect(ev.text).toContain("Vraag 1 was goed.");
  });

  it("does not change when the course changes afterwards; refreshing takes the course as it is now", async () => {
    const { c, d } = await setup();
    await act(c.id, { intent: "use-as-evidence", dossierId: d.id, part: `dossier:${TEST1}` });
    const before = await lastEvidence("dev-a", d.id);
    const data = documentedCourse();
    data.assessments[1]!.passMark = 60;
    await courses.updateCourse("dev-a", c.id, { data });
    const kept = await lastEvidence("dev-a", d.id);
    expect(kept.text).toBe(before.text);
    expect(kept.text).toContain("Cesuur: 75%");

    const dossier = (await portfolio.getDossier("dev-a", d.id))!;
    const refreshed = await evidence.refreshCourseEvidence("dev-a", dossier.data, kept.id, "nl");
    expect(refreshed.ok).toBe(true);
    const text = refreshed.ok ? refreshed.data.evidence.at(-1)!.text : "";
    expect(text).toContain("Cesuur: 60%");
    expect(text).toContain("Vraag 1 was goed.");
  });

  it("a co-owner may, with only their own analysis; an editor may not", async () => {
    const { c } = await setup();
    await members.setCourseMember("dev-a", c.id, "dev-b", "co-owner");
    await members.setCourseMember("dev-a", c.id, "dev-c", "editor");

    await signInAs({ id: "dev-b" });
    const theirs = await portfolio.createDossier("dev-b", "BKE B", fixtures.sampleDossier());
    expect(
      await act(c.id, {
        intent: "use-as-evidence",
        dossierId: theirs.id,
        part: `dossier:${TEST1}`,
      }),
    ).toEqual({ ok: true, intent: "use-as-evidence" });
    const ev = await lastEvidence("dev-b", theirs.id);
    expect(ev.text).toContain("Nog geen toetsanalyse gekoppeld");
    expect(ev.text).not.toContain("Vraag 1 was goed.");

    await signInAs({ id: "dev-c" });
    const editors = await portfolio.createDossier("dev-c", "BKE C", fixtures.sampleDossier());
    expect(
      await act(c.id, {
        intent: "use-as-evidence",
        dossierId: editors.id,
        part: `dossier:${TEST1}`,
      }),
    ).toMatchObject({ ok: false });
    expect((await portfolio.getDossier("dev-c", editors.id))!.data).toEqual(
      fixtures.sampleDossier(),
    );
  });

  it("refuses a test that is not in the course", async () => {
    const { c, d } = await setup();
    expect(
      await act(c.id, { intent: "use-as-evidence", dossierId: d.id, part: "dossier:nope" }),
    ).toMatchObject({ ok: false });
  });
});
