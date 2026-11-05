import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { alignedCourse, ACT1, LO1, LO2, QUIZ } from "../courses/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { currentUser } = vi.hoisted(() => ({
  currentUser: { value: { id: "teacher-a", name: "A", email: null, role: "teacher" } as never },
}));
vi.mock("~/server/auth.server", () => ({
  requireUser: vi.fn(async () => currentUser.value),
  requireRole: vi.fn(async () => currentUser.value),
}));

let repo: typeof import("~/server/repositories/courses.server");
let profiles: typeof import("~/server/repositories/profiles.server");
let list: typeof import("~/routes/courses._index");
let detail: typeof import("~/routes/courses.$id");

beforeAll(async () => {
  repo = await import("~/server/repositories/courses.server");
  profiles = await import("~/server/repositories/profiles.server");
  list = await import("~/routes/courses._index");
  detail = await import("~/routes/courses.$id");
});

beforeEach(() => {
  currentUser.value = { id: "teacher-a", name: "A", email: null, role: "teacher" } as never;
});

function post(path: string, fields: Record<string, string | string[]>, locale = "nl"): Request {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields))
    for (const value of Array.isArray(v) ? v : [v]) body.append(k, value);
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: `lang=${locale}` },
    body: body.toString(),
  });
}

const get = (path: string) => new Request(`http://localhost${path}`);

async function status(p: Promise<unknown>): Promise<number | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}

const act = (id: string, fields: Record<string, string | string[]>, locale?: string) =>
  detail.action({ request: post(`/courses/${id}`, fields, locale), params: { id } } as never);

describe("/courses", () => {
  it("creates a course with an own context profile and opens it", async () => {
    const p = await profiles.createProfile("teacher-a", { name: "SE jaar 2" });
    const r = await list.action({
      request: post("/courses", { intent: "create", name: "SE — jaar 2", contextProfileId: p.id }),
    } as never);
    expect(r).toBeInstanceOf(Response);
    const location = (r as Response).headers.get("Location") ?? "";
    expect(location).toMatch(/^\/courses\/[0-9a-f-]{36}$/);
    const course = await repo.getCourse("teacher-a", location.split("/").pop() ?? "");
    expect(course).toMatchObject({ name: "SE — jaar 2", contextProfileId: p.id });
  });

  it("refuses an empty name and someone else's profile, with a localized error", async () => {
    const theirs = await profiles.createProfile("teacher-b", { name: "B" });
    expect(
      await list.action({ request: post("/courses", { intent: "create", name: " " }) } as never),
    ).toEqual({ ok: false, error: "Geef de cursus een naam van hooguit 200 tekens." });
    expect(
      await list.action({
        request: post("/courses", { intent: "create", name: "x", contextProfileId: theirs.id }),
      } as never),
    ).toMatchObject({ ok: false });
  });

  it("lists the caller's courses with the number of findings", async () => {
    await repo.createCourse("teacher-a", { name: "Met data", data: alignedCourse() });
    await repo.createCourse("teacher-b", { name: "Van B" });
    const data = await list.loader({ request: get("/courses") } as never);
    const names = data.courses.map((c) => c.name);
    expect(names).toContain("Met data");
    expect(names).not.toContain("Van B");
    expect(data.courses.find((c) => c.name === "Met data")).toMatchObject({
      outcomes: 2,
      findings: 0,
    });
  });

  it("deletes only the caller's course", async () => {
    const theirs = await repo.createCourse("teacher-b", { name: "Van B" });
    expect(
      await list.action({
        request: post("/courses", { intent: "delete", id: theirs.id }),
      } as never),
    ).toMatchObject({ ok: false });
    expect(await repo.getCourse("teacher-b", theirs.id)).not.toBeNull();
    const mine = await repo.createCourse("teacher-a", { name: "Weg" });
    expect(
      await list.action({ request: post("/courses", { intent: "delete", id: mine.id }) } as never),
    ).toEqual({ ok: true, intent: "delete" });
    expect(await repo.getCourse("teacher-a", mine.id)).toBeNull();
  });
});

describe("/courses/:id", () => {
  it("loads the course with findings and the matrix", async () => {
    const c = await repo.createCourse("teacher-a", { name: "SE", data: alignedCourse() });
    const data = await detail.loader({
      request: get(`/courses/${c.id}`),
      params: { id: c.id },
    } as never);
    expect(data.course.name).toBe("SE");
    expect(data.findings).toEqual([]);
    expect(data.matrix.rows).toHaveLength(2);
    expect(data.linkedWork).toEqual([]);
  });

  it("loads the linked work with the tool name and the item title (20.4)", async () => {
    const gens = await import("~/server/repositories/generations.server");
    const c = await repo.createCourse("teacher-a", { name: "SE", data: alignedCourse() });
    const g = await gens.saveGeneration({
      userId: "teacher-a",
      toolSlug: "authentic-assessment",
      input: {},
      outputMarkdown: "# Toets",
      model: "test",
      outputLanguage: "nl",
    } as never);
    await repo.linkGeneration("teacher-a", c.id, g.id, QUIZ);
    const data = await detail.loader({
      request: get(`/courses/${c.id}`),
      params: { id: c.id },
    } as never);
    expect(data.linkedWork).toEqual([
      {
        generationId: g.id,
        toolName: { nl: "Authentieke toets ontwerpen", en: "Design an authentic assessment" },
        itemTitle: "Oefentoets",
        createdAt: g.createdAt,
      },
    ]);
  });

  it("is a 404 for someone else's course, for loader and action", async () => {
    const theirs = await repo.createCourse("teacher-b", { name: "Van B" });
    expect(
      await status(
        detail.loader({
          request: get(`/courses/${theirs.id}`),
          params: { id: theirs.id },
        } as never),
      ),
    ).toBe(404);
    expect(await status(act(theirs.id, { intent: "add-outcome", text: "x" }))).toBe(404);
    expect((await repo.getCourse("teacher-b", theirs.id))?.data.outcomes).toEqual([]);
  });

  it("saves every intent", async () => {
    const c = await repo.createCourse("teacher-a", { name: "Alles" });
    expect(await act(c.id, { intent: "add-outcome", text: "Je test.", bloom: "apply" })).toEqual({
      ok: true,
    });
    let data = (await repo.getCourse("teacher-a", c.id))!.data;
    const lo = data.outcomes[0].id;
    await act(c.id, {
      intent: "update-outcome",
      id: lo,
      text: "Je test software.",
      bloom: "analyze",
    });
    await act(c.id, {
      intent: "add-activity",
      title: "Les",
      kind: "lesson",
      week: "1",
      outcomeIds: lo,
    });
    data = (await repo.getCourse("teacher-a", c.id))!.data;
    const act1 = data.activities[0].id;
    await act(c.id, {
      intent: "update-activity",
      id: act1,
      title: "Les 1",
      kind: "lesson",
      outcomeIds: lo,
    });
    await act(c.id, {
      intent: "add-assessment",
      title: "Toets",
      kind: "summative",
      weight: "100",
      coverage: lo,
      [`bloom:${lo}`]: "analyze",
    });
    data = (await repo.getCourse("teacher-a", c.id))!.data;
    const test = data.assessments[0].id;
    await act(c.id, {
      intent: "update-assessment",
      id: test,
      title: "Eindtoets",
      kind: "summative",
      coverage: lo,
    });
    await act(c.id, { intent: "set-ec", ec: "5" });
    expect(
      await act(c.id, { intent: "settings", name: "Alles — nieuw", contextProfileId: "" }),
    ).toEqual({ ok: true });
    const saved = (await repo.getCourse("teacher-a", c.id))!;
    expect(saved.name).toBe("Alles — nieuw");
    expect(saved.data).toMatchObject({
      ec: 5,
      outcomes: [{ id: lo, text: "Je test software.", bloom: "analyze" }],
      activities: [{ id: act1, title: "Les 1", outcomeIds: [lo] }],
      assessments: [{ id: test, title: "Eindtoets", coverage: [{ outcomeId: lo }] }],
    });
    await act(c.id, { intent: "remove-assessment", id: test });
    await act(c.id, { intent: "remove-activity", id: act1 });
    await act(c.id, { intent: "remove-outcome", id: lo });
    expect((await repo.getCourse("teacher-a", c.id))!.data).toEqual({
      ec: 5,
      outcomes: [],
      activities: [],
      assessments: [],
    });
  });

  it("remove-outcome drops the references to it", async () => {
    const c = await repo.createCourse("teacher-a", { name: "Refs", data: alignedCourse() });
    await act(c.id, { intent: "remove-outcome", id: LO2 });
    const d = (await repo.getCourse("teacher-a", c.id))!.data;
    expect(d.activities.find((a) => a.id === ACT1)?.outcomeIds).toEqual([]);
    expect(d.assessments.find((a) => a.id === QUIZ)?.coverage).toEqual([]);
  });

  it("refuses an invalid payload with a localized error and saves nothing", async () => {
    const c = await repo.createCourse("teacher-a", { name: "Fout", data: alignedCourse() });
    expect(
      await act(c.id, { intent: "add-activity", title: "x", kind: "lesson", outcomeIds: "ghost" }),
    ).toEqual({
      ok: false,
      error: "Dat kon niet worden opgeslagen. Controleer de velden en probeer het opnieuw.",
    });
    expect(await act(c.id, { intent: "add-outcome", text: "x".repeat(1001) }, "en")).toEqual({
      ok: false,
      error: "That could not be saved. Check the fields and try again.",
    });
    expect(await act(c.id, { intent: "remove-outcome", id: "ghost" })).toMatchObject({ ok: false });
    expect(await act(c.id, { intent: "settings", name: "" })).toMatchObject({ ok: false });
    const d = (await repo.getCourse("teacher-a", c.id))!;
    expect(d.data).toEqual(alignedCourse());
    expect(d.name).toBe("Fout");
    expect(d.data.outcomes.map((o) => o.id)).toEqual([LO1, LO2]);
  });
});
