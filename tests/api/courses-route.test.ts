import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { alignedCourse, ACT1, LO1, LO2, QUIZ, TEST1 } from "../courses/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

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

beforeEach(async () => {
  await signInAs({ id: "teacher-a", name: "A" });
});

function post(path: string, fields: Record<string, string | string[]>, locale = "nl"): Request {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields))
    for (const value of Array.isArray(v) ? v : [v]) body.append(k, value);
  return signedRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: `lang=${locale}` },
    body: body.toString(),
  });
}

const get = (path: string) => signedRequest(`http://localhost${path}`);

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

  it("saves the module code and study year with the settings", async () => {
    const c = await repo.createCourse("teacher-a", { name: "Module", data: alignedCourse() });
    expect(
      await act(c.id, {
        intent: "settings",
        name: "Module",
        code: "HELWO",
        studyYear: "2026-2027",
      }),
    ).toEqual({ ok: true });
    expect((await repo.getCourse("teacher-a", c.id))!.data).toMatchObject({
      code: "HELWO",
      studyYear: "2026-2027",
    });
    await act(c.id, { intent: "settings", name: "Module", code: "", studyYear: "" });
    expect((await repo.getCourse("teacher-a", c.id))!.data.code).toBeUndefined();
  });

  it("saves the start date with the settings and gives the week dates (P22.1)", async () => {
    const settings = await import("~/server/repositories/settings.server");
    await settings.setBreakWeeks(["2026-09-14"]);
    const c = await repo.createCourse("teacher-a", { name: "Datums", data: alignedCourse() });
    const load = () =>
      detail.loader({ request: get(`/courses/${c.id}`), params: { id: c.id } } as never);
    expect((await load()).weekDates).toBeNull();
    expect(
      await act(c.id, { intent: "settings", name: "Datums", startDate: "2026-09-02" }),
    ).toEqual({ ok: true });
    expect((await repo.getCourse("teacher-a", c.id))!.data.startDate).toBe("2026-09-02");
    // Week 1 from the Monday of the start week; the break week is skipped.
    expect((await load()).weekDates?.slice(0, 3)).toEqual([
      "2026-08-31",
      "2026-09-07",
      "2026-09-21",
    ]);
    expect(
      await act(c.id, { intent: "settings", name: "Datums", startDate: "morgen" }),
    ).toMatchObject({ ok: false });
    await act(c.id, { intent: "settings", name: "Datums", startDate: "" });
    expect((await repo.getCourse("teacher-a", c.id))!.data.startDate).toBeUndefined();
    await settings.setBreakWeeks([]);
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
        itemId: QUIZ,
        itemTitle: "Oefentoets",
        createdAt: g.createdAt,
      },
    ]);
  });

  it("gives the current course week, or null without a start date (P27.4)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-25T10:00:00Z")); // Wednesday of week 2
    await signInAs({ id: "teacher-a" }); // a session from now, not from days ago
    try {
      const dated = await repo.createCourse("teacher-a", {
        name: "Met datum",
        data: { ...alignedCourse(), startDate: "2026-11-16" },
      });
      const plain = await repo.createCourse("teacher-a", { name: "Zonder", data: alignedCourse() });
      const load = (id: string) =>
        detail.loader({ request: get(`/courses/${id}`), params: { id } } as never);
      expect((await load(dated.id)).currentWeek).toBe(2);
      expect((await load(plain.id)).currentWeek).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers the course tools the teacher may use, per kind and per finding (P27.4)", async () => {
    const settings = await import("~/server/repositories/settings.server");
    const c = await repo.createCourse("teacher-a", { name: "Tools", data: alignedCourse() });
    const load = () =>
      detail.loader({ request: get(`/courses/${c.id}`), params: { id: c.id } } as never);
    const data = await load();
    expect(data.tools.activity.map((t) => t.slug)).toContain("lesson-plan");
    expect(data.tools.assessment.map((t) => t.slug)).toContain("test-items");
    expect(data.tools.findings["outcome-not-assessed"]?.slug).toBe("test-items");
    await settings.setToolStand("lesson-plan", "off");
    try {
      const off = await load();
      expect(off.tools.activity.map((t) => t.slug)).not.toContain("lesson-plan");
      expect(off.tools.findings["outcome-not-taught"]).toBeUndefined();
    } finally {
      await settings.setToolStand("lesson-plan", null);
    }
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
    const lo = data.outcomes[0]!.id;
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
    const act1 = data.activities[0]!.id;
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
    const test = data.assessments[0]!.id;
    await act(c.id, {
      intent: "update-assessment",
      id: test,
      title: "Eindtoets",
      kind: "summative",
      coverage: lo,
    });
    await act(c.id, { intent: "set-ec", ec: "5" });
    await act(c.id, { intent: "set-schedule", sessionMinutes: "240", deliveryMode: "hybrid" });
    expect(
      await act(c.id, { intent: "settings", name: "Alles — nieuw", contextProfileId: "" }),
    ).toEqual({ ok: true });
    const saved = (await repo.getCourse("teacher-a", c.id))!;
    expect(saved.name).toBe("Alles — nieuw");
    expect(saved.data).toMatchObject({
      ec: 5,
      schedule: { sessionMinutes: 240, deliveryMode: "hybrid" },
      outcomes: [{ id: lo, text: "Je test software.", bloom: "analyze" }],
      activities: [{ id: act1, title: "Les 1", outcomeIds: [lo] }],
      assessments: [{ id: test, title: "Eindtoets", coverage: [{ outcomeId: lo }] }],
    });
    await act(c.id, { intent: "remove-assessment", id: test });
    await act(c.id, { intent: "remove-activity", id: act1 });
    await act(c.id, { intent: "remove-outcome", id: lo });
    expect((await repo.getCourse("teacher-a", c.id))!.data).toEqual({
      ec: 5,
      schedule: { sessionMinutes: 240, deliveryMode: "hybrid" },
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

  it("saves every question intent of the matrix (P26.1) and refuses a bad one", async () => {
    const c = await repo.createCourse("teacher-a", { name: "Matrijs", data: alignedCourse() });
    expect(
      await act(c.id, {
        intent: "add-item",
        assessmentId: TEST1,
        label: "1",
        outcomeId: LO1,
        bloom: "create",
        format: "open",
        points: "4",
      }),
    ).toEqual({ ok: true });
    let items = (await repo.getCourse("teacher-a", c.id))!.data.assessments[1]!.items!;
    expect(items).toMatchObject([{ label: "1", outcomeId: LO1, points: 4 }]);
    const id = items[0]!.id;
    expect(
      await act(c.id, {
        intent: "update-item",
        assessmentId: TEST1,
        id,
        label: "1a",
        outcomeId: LO2,
        points: "",
      }),
    ).toEqual({ ok: true });
    items = (await repo.getCourse("teacher-a", c.id))!.data.assessments[1]!.items!;
    expect(items).toEqual([{ id, label: "1a", outcomeId: LO2 }]);

    expect(
      await act(c.id, { intent: "add-item", assessmentId: TEST1, label: "2", outcomeId: "ghost" }),
    ).toMatchObject({ ok: false });
    expect(
      await act(c.id, {
        intent: "update-item",
        assessmentId: TEST1,
        id,
        label: "1",
        outcomeId: LO1,
        points: "-3",
      }),
    ).toMatchObject({ ok: false });
    expect((await repo.getCourse("teacher-a", c.id))!.data.assessments[1]!.items).toEqual(items);

    expect(await act(c.id, { intent: "remove-item", assessmentId: TEST1, id })).toEqual({
      ok: true,
    });
    expect((await repo.getCourse("teacher-a", c.id))!.data.assessments[1]!.items).toEqual([]);
  });

  describe("import-blueprint (P26.2)", () => {
    const BLUEPRINT = [
      "## Toetsmatrijs",
      "",
      "| Rij | Leeruitkomst | Denkniveau | Vraagvorm | Aantal vragen | Punten per vraag | Punten |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| R1 | Je ontwerpt een datamodel. | Creëren | Open | 2 | 5 | 10 |",
      "| R2 | Normaliseren | Begrijpen | Meerkeuze | 3 | 1 | 3 |",
      "| Totaal | | | | 5 | | 13 |",
    ].join("\n");

    async function blueprintGeneration(userId: string, output = BLUEPRINT, stageId = "blueprint") {
      const gens = await import("~/server/repositories/generations.server");
      return gens.saveGeneration({
        userId,
        toolSlug: "test-items",
        stageId,
        input: {},
        outputMarkdown: output,
        model: "test",
        outputLanguage: "nl",
      });
    }

    async function linkedSetup() {
      const c = await repo.createCourse("teacher-a", { name: "Matrijs", data: alignedCourse() });
      const g = await blueprintGeneration("teacher-a");
      await repo.linkGeneration("teacher-a", c.id, g.id);
      return { c, g };
    }

    it("the loader offers the blueprint of linked work, with a proposal per row", async () => {
      const { c, g } = await linkedSetup();
      const data = await detail.loader({
        request: get(`/courses/${c.id}`),
        params: { id: c.id },
      } as never);
      const work = data.linkedWork.find((w) => w.generationId === g.id);
      expect(work?.blueprint).toMatchObject({
        rows: [
          { row: "R1", count: 2 },
          { row: "R2", count: 3 },
        ],
        totalMismatch: false,
        proposal: { R1: LO1, R2: "" },
      });
    });

    it("the loader explains why a result cannot become a blueprint", async () => {
      const c = await repo.createCourse("teacher-a", { name: "Geen", data: alignedCourse() });
      const g = await blueprintGeneration("teacher-a", "## Toetsmatrijs\n\nGeen tabel.");
      const items = await blueprintGeneration("teacher-a", BLUEPRINT, "items");
      await repo.linkGeneration("teacher-a", c.id, g.id);
      await repo.linkGeneration("teacher-a", c.id, items.id);
      const data = await detail.loader({
        request: get(`/courses/${c.id}`),
        params: { id: c.id },
      } as never);
      expect(data.linkedWork.find((w) => w.generationId === g.id)?.blueprint).toEqual({
        error: "no-table",
      });
      // The questions stage is not a blueprint: no button, no reason.
      expect(data.linkedWork.find((w) => w.generationId === items.id)?.blueprint).toBeUndefined();
    });

    it("puts the blueprint in a new summative test", async () => {
      const { c, g } = await linkedSetup();
      expect(
        await act(c.id, {
          intent: "import-blueprint",
          generationId: g.id,
          assessmentId: "new",
          newTitle: "Tentamen",
          "map:R1": LO1,
          "map:R2": LO2,
        }),
      ).toEqual({ ok: true, intent: "import-blueprint", added: 5 });
      const d = (await repo.getCourse("teacher-a", c.id))!.data;
      const test = d.assessments.at(-1)!;
      expect(test).toMatchObject({ title: "Tentamen", kind: "summative", coverage: [] });
      expect(test.items?.map((i) => [i.label, i.outcomeId, i.points])).toEqual([
        ["1", LO1, 5],
        ["2", LO1, 5],
        ["3", LO2, 1],
        ["4", LO2, 1],
        ["5", LO2, 1],
      ]);
    });

    it("replaces existing questions only after the explicit choice", async () => {
      const { c, g } = await linkedSetup();
      const fields = {
        intent: "import-blueprint",
        generationId: g.id,
        assessmentId: TEST1,
        "map:R1": LO1,
        "map:R2": "",
      };
      expect(await act(c.id, fields)).toMatchObject({ ok: true, added: 2 });
      expect(await act(c.id, fields)).toEqual({
        ok: false,
        intent: "import-blueprint",
        error:
          'Deze toets heeft al vragen. Kies "Vervang de bestaande vragen" als je ze wilt overschrijven.',
      });
      expect(await act(c.id, { ...fields, "map:R2": LO2, replace: "1" })).toMatchObject({
        ok: true,
        added: 5,
      });
      const d = (await repo.getCourse("teacher-a", c.id))!.data;
      expect(d.assessments.find((a) => a.id === TEST1)?.items).toHaveLength(5);
    });

    it("refuses a foreign or unlinked generation with a 404, and a bad mapping", async () => {
      const { c } = await linkedSetup();
      const theirs = await blueprintGeneration("teacher-b");
      const unlinked = await blueprintGeneration("teacher-a");
      const base = { intent: "import-blueprint", assessmentId: "new", "map:R1": LO1 };
      expect(await status(act(c.id, { ...base, generationId: theirs.id }))).toBe(404);
      expect(await status(act(c.id, { ...base, generationId: unlinked.id }))).toBe(404);
      const { c: c2, g } = await linkedSetup();
      expect(await act(c2.id, { ...base, generationId: g.id, "map:R1": "ghost" })).toMatchObject({
        ok: false,
      });
      expect(await act(c2.id, { ...base, generationId: g.id, "map:R1": "" })).toMatchObject({
        ok: false,
      });
      expect((await repo.getCourse("teacher-a", c2.id))!.data).toEqual(alignedCourse());
    });
  });

  describe("use-as-evidence (P26.4)", () => {
    async function setup() {
      const portfolio = await import("~/server/repositories/portfolio.server");
      const exceptions = await import("~/server/repositories/exceptions.server");
      const { sampleDossier, C1, C2 } = await import("../portfolio/fixtures");
      await exceptions.setException("teacher-a", exceptions.featureKey("portfolio"), "on");
      const data = alignedCourse();
      data.assessments[1]!.items = [
        { id: "q-1", label: "1", outcomeId: LO1, bloom: "create", points: 6 },
        { id: "q-2", label: "2", outcomeId: LO2, bloom: "analyze", points: 4 },
      ];
      const c = await repo.createCourse("teacher-a", { name: "Databases", data });
      const d = await portfolio.createDossier("teacher-a", "Mijn BKE", sampleDossier());
      return { portfolio, c, d, C1, C2 };
    }

    it("the loader offers the caller's dossiers with their criteria", async () => {
      const { c, d, C1 } = await setup();
      const data = await detail.loader({
        request: get(`/courses/${c.id}`),
        params: { id: c.id },
      } as never);
      const mine = data.dossiers.find((x) => x.id === d.id);
      expect(mine).toMatchObject({ name: "Mijn BKE" });
      expect(mine?.outcomes[0]?.criteria.map((x) => x.id)).toContain(C1);
    });

    it("adds a snapshot of one test's blueprint as test material, linked to the criteria", async () => {
      const { portfolio, c, d, C1, C2 } = await setup();
      expect(
        await act(c.id, {
          intent: "use-as-evidence",
          dossierId: d.id,
          part: `assessment:${TEST1}`,
          criterionIds: [C1, C2],
        }),
      ).toEqual({ ok: true, intent: "use-as-evidence" });
      const ev = (await portfolio.getDossier("teacher-a", d.id))!.data.evidence.at(-1)!;
      expect(ev).toMatchObject({
        title: "Databases: toetsmatrijs Eindopdracht",
        kind: "test-material",
        criterionIds: [C1, C2],
        // P29.1: the question count feeds "Klaar om in te leveren?".
        sourceCourse: { courseId: c.id, part: { assessmentId: TEST1 }, itemCount: 2 },
      });
      expect(ev.text).toContain("| **Totaal** | 2 vragen |  |  | 10 |");
      expect(ev.sourceCourse?.at).toBeGreaterThan(0);
    });

    it("the outcomes and matrix go in as 'other'", async () => {
      const { portfolio, c, d } = await setup();
      await act(c.id, { intent: "use-as-evidence", dossierId: d.id, part: "outcomes-and-matrix" });
      const ev = (await portfolio.getDossier("teacher-a", d.id))!.data.evidence.at(-1)!;
      expect(ev).toMatchObject({ kind: "other", criterionIds: [] });
      expect(ev.sourceCourse).not.toHaveProperty("itemCount");
      expect(ev.text).toContain("### Dekkingsmatrix");
    });

    it("a foreign dossier is a 404 and nothing is written; an unknown criterion is an error", async () => {
      const { portfolio, c, d } = await setup();
      const { sampleDossier } = await import("../portfolio/fixtures");
      const theirs = await portfolio.createDossier("teacher-b", "Van B", sampleDossier());
      const fields = { intent: "use-as-evidence", part: "outcomes-and-matrix" };
      expect(await status(act(c.id, { ...fields, dossierId: theirs.id }))).toBe(404);
      expect((await portfolio.getDossier("teacher-b", theirs.id))!.data).toEqual(sampleDossier());
      expect(await act(c.id, { ...fields, dossierId: d.id, criterionIds: "ghost" })).toEqual({
        ok: false,
        intent: "use-as-evidence",
        error: "Dat criterium staat niet in dit dossier.",
      });
      expect(
        await act(c.id, { ...fields, dossierId: d.id, part: "assessment:nope" }),
      ).toMatchObject({ ok: false });
      expect((await portfolio.getDossier("teacher-a", d.id))!.data).toEqual(sampleDossier());
    });

    it("a foreign course is a 404", async () => {
      const { d } = await setup();
      const theirs = await repo.createCourse("teacher-b", { name: "B" });
      expect(
        await status(
          act(theirs.id, {
            intent: "use-as-evidence",
            dossierId: d.id,
            part: "outcomes-and-matrix",
          }),
        ),
      ).toBe(404);
    });
  });
});

describe("pack tags on learning outcomes (P21.6)", () => {
  const ictProfile = () =>
    profiles.createProfile("teacher-a", {
      name: "ICT jaar 2",
      country: "NL",
      sector: "hbo",
      domain: "ICT",
    } as never);

  it("the loader offers the pack of the course's profile, or none", async () => {
    const p = await ictProfile();
    const tagged = await repo.createCourse("teacher-a", { name: "ICT", contextProfileId: p.id });
    const r = (await detail.loader({
      request: get(`/courses/${tagged.id}`),
      params: { id: tagged.id },
    } as never)) as { pack?: { source: unknown } };
    expect(r.pack?.source).toEqual({
      nl: "hbo-i domeinbeschrijving",
      en: "hbo-i domain description",
    });
    const plain = await repo.createCourse("teacher-a", { name: "Zonder profiel" });
    const r2 = (await detail.loader({
      request: get(`/courses/${plain.id}`),
      params: { id: plain.id },
    } as never)) as { pack?: unknown };
    expect(r2.pack).toBeUndefined();
  });

  it("saves tags from the pack and refuses an unknown option", async () => {
    const p = await ictProfile();
    const c = await repo.createCourse("teacher-a", { name: "ICT", contextProfileId: p.id });
    expect(
      await act(c.id, {
        intent: "add-outcome",
        text: "Je ontwerpt software.",
        "tag:beheersingsniveau": "2",
        "tag:activiteiten": ["Ontwerpen", "Realiseren"],
      }),
    ).toEqual({ ok: true });
    expect((await repo.getCourse("teacher-a", c.id))!.data.outcomes[0]!.packTags).toEqual({
      beheersingsniveau: 2,
      activiteiten: ["Ontwerpen", "Realiseren"],
    });
    const refused = (await act(c.id, {
      intent: "add-outcome",
      text: "Je danst.",
      "tag:activiteiten": "Dansen",
    })) as { ok: boolean };
    expect(refused.ok).toBe(false);
    expect((await repo.getCourse("teacher-a", c.id))!.data.outcomes).toHaveLength(1);
  });
});
