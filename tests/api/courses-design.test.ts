import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { generate, currentUser, quota, recordUsage, featureOff } = vi.hoisted(() => ({
  generate: vi.fn(),
  currentUser: { value: { id: "teacher-d", name: "D", email: null, role: "teacher" } as never },
  quota: { ok: true },
  recordUsage: vi.fn(async () => {}),
  featureOff: new Set<string>(),
}));
vi.mock("~/lib/ai/provider", () => ({ providerForModel: () => ({ id: "fake", generate }) }));
vi.mock("~/server/auth.server", () => ({
  requireUser: vi.fn(async () => currentUser.value),
  requireRole: vi.fn(async () => currentUser.value),
}));
vi.mock("~/server/repositories/usage.server", () => ({
  checkQuota: vi.fn(async () => ({ ok: quota.ok })),
  recordUsage,
}));
vi.mock("~/server/availability.server", () => ({
  effectiveDefaultModel: vi.fn(async () => "claude-sonnet-5-5"),
  getAvailableTools: vi.fn(async () => []),
  requireFeature: vi.fn(async (_u: unknown, id: string) => {
    if (featureOff.has(id)) throw new Response("Not Found", { status: 404 });
  }),
  isFeatureOn: vi.fn(async (_u: unknown, id: string) => !featureOff.has(id)),
}));

let repo: typeof import("~/server/repositories/courses.server");
let profiles: typeof import("~/server/repositories/profiles.server");
let detail: typeof import("~/routes/courses.$id");

beforeAll(async () => {
  repo = await import("~/server/repositories/courses.server");
  profiles = await import("~/server/repositories/profiles.server");
  detail = await import("~/routes/courses.$id");
});

beforeEach(() => {
  generate.mockReset();
  recordUsage.mockClear();
  quota.ok = true;
  featureOff.clear();
});

function post(id: string, fields: [string, string][], locale = "nl") {
  const body = new URLSearchParams(fields);
  const request = new Request(`http://localhost/courses/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: `lang=${locale}` },
    body: body.toString(),
  });
  return detail.action({ request, params: { id } } as never);
}

const DESCRIPTION =
  "Studenten leren een relationele database ontwerpen voor een webwinkel en die bevragen met SQL.";
const answer = JSON.stringify({
  outcomes: [
    {
      text: "De student ontwerpt een genormaliseerd datamodel voor een webwinkel.",
      bloom: "create",
      criteria: ["Elke tabel heeft een sleutel.", "Het model staat in de derde normaalvorm."],
    },
    { text: "De student schrijft SQL-queries met joins.", bloom: "apply", criteria: [] },
  ],
  notes: "Ik ging uit van hbo, jaar 1.",
});
const design = (extra: [string, string][] = []): [string, string][] => [
  ["intent", "design-outcomes"],
  ["description", DESCRIPTION],
  ...extra,
];

describe("design-outcomes", () => {
  it("returns a design proposal and keeps what the teacher typed in the course", async () => {
    const p = await profiles.createProfile("teacher-d", {
      name: "Bouwkunde jaar 2",
      programme: "Bouwkunde",
    } as never);
    const course = await repo.createCourse("teacher-d", {
      name: "Databases",
      contextProfileId: p.id,
      data: {
        outcomes: [],
        activities: [],
        assessments: [],
        disciplines: [{ id: "d1", name: "Wiskunde" }],
      },
    });
    generate.mockResolvedValueOnce({ text: answer, usage: { output: 80 } });
    const r = await post(
      course.id,
      design([
        ["ec", "5"],
        ["weeks", "8"],
      ]),
    );
    if (!r.ok || r.intent !== "design-outcomes") throw new Error(JSON.stringify(r));
    expect(r.proposal.source).toBe("design");
    expect(r.proposal.outcomes.map((o) => o.text)).toEqual([
      "De student ontwerpt een genormaliseerd datamodel voor een webwinkel.",
      "De student schrijft SQL-queries met joins.",
    ]);
    expect(recordUsage).toHaveBeenCalledOnce();
    const call = generate.mock.calls[0]![0];
    expect(call.system).toContain("Voice & Bounds");
    expect(call.temperature).toBe(0);
    const message = call.messages[0].content as string;
    expect(message).toContain("<course>Databases</course>");
    expect(message).toContain("<studyLoad>5 EC</studyLoad>");
    expect(message).toContain("- Wiskunde");
    expect(message).toContain("Bouwkunde");
    expect(message).toContain(DESCRIPTION);
    // The outcomes wait for the teacher; the EC, weeks and description are kept now.
    const saved = (await repo.getCourse("teacher-d", course.id))?.data;
    expect(saved?.outcomes).toEqual([]);
    expect(saved).toMatchObject({ ec: 5, schedule: { weeks: 8 }, description: DESCRIPTION });
  });

  it("adds the ticked outcomes through import-apply", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Apply" });
    const r = await post(course.id, [
      ["intent", "import-apply"],
      ["outcomeKey", "o1"],
      ["o1.pick", "on"],
      ["o1.text", "De student schrijft SQL-queries met joins."],
      ["o1.bloom", "apply"],
      ["o1.extra", JSON.stringify({ criteria: [{ text: "De query klopt." }] })],
    ]);
    expect(r).toMatchObject({ ok: true, intent: "import-apply" });
    expect((await repo.getCourse("teacher-d", course.id))?.data.outcomes[0]).toMatchObject({
      text: "De student schrijft SQL-queries met joins.",
      criteria: [{ text: "De query klopt." }],
    });
  });

  it("says what the AI still needs when the description says too little", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Vaag" });
    const why = "Wat moeten studenten na de cursus kunnen?";
    generate.mockResolvedValue({ text: JSON.stringify({ outcomes: [], notes: why }) });
    const r = await post(course.id, design());
    expect(generate).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ ok: false, intent: "design-outcomes", notes: why });
  });

  it("retries once on broken JSON, then gives a localized failure", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Kapot" });
    generate.mockResolvedValue({ text: "{ kapot" });
    const r = await post(course.id, design(), "en");
    expect(generate).toHaveBeenCalledTimes(2);
    if (r.ok) throw new Error("expected a failure");
    expect(r.error).toMatch(/could not/i);
  });

  it("refuses an empty description and a teacher over the quota, without a model call", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Gates" });
    expect(
      await post(course.id, [
        ["intent", "design-outcomes"],
        ["description", " "],
      ]),
    ).toMatchObject({ ok: false, intent: "design-outcomes" });
    quota.ok = false;
    expect(await post(course.id, design())).toMatchObject({ ok: false });
    expect(generate).not.toHaveBeenCalled();
  });

  it("is a 404 when the admin switched the course wizard off", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Uit" });
    featureOff.add("courseDesign");
    const status = await post(course.id, design()).then(
      () => undefined,
      (e) => (e instanceof Response ? e.status : -1),
    );
    expect(status).toBe(404);
    expect(generate).not.toHaveBeenCalled();
  });

  it("is refused for a course that is not the teacher's", async () => {
    const theirs = await repo.createCourse("teacher-x", { name: "Van een ander" });
    const status = await post(theirs.id, design()).then(
      () => undefined,
      (e) => (e instanceof Response ? e.status : -1),
    );
    expect(status).toBe(404);
  });
});

const programme = JSON.stringify({
  assessments: [
    {
      title: "Proeftoets SQL",
      kind: "formative",
      week: 3,
      weight: null,
      outcomeRefs: [2],
      form: "Praktijktoets",
    },
    {
      title: "Ontwerp webwinkel",
      kind: "summative",
      week: 8,
      weight: 100,
      outcomeRefs: [1, 2],
      form: "Beroepsproduct met mondelinge toelichting",
    },
  ],
  notes: "Weging is een voorstel.",
});
const withOutcomes = {
  ec: 5,
  schedule: { weeks: 8 },
  outcomes: [
    { id: "lo1", text: "De student ontwerpt een datamodel.", bloom: "create" as const },
    {
      id: "lo2",
      text: "De student schrijft SQL-queries.",
      bloom: "apply" as const,
      criteria: [{ text: "De query klopt." }],
    },
  ],
  activities: [],
  assessments: [],
};
const assess = (extra: [string, string][] = []): [string, string][] => [
  ["intent", "design-assessments"],
  ...extra,
];

describe("design-assessments", () => {
  it("proposes a test programme over the course's outcomes, and stores nothing", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Toetsen", data: withOutcomes });
    generate.mockResolvedValueOnce({ text: programme, usage: { output: 80 } });
    const r = await post(course.id, assess([["forms", "Kennistoets, Beroepsproduct"]]));
    if (!r.ok || r.intent !== "design-assessments") throw new Error(JSON.stringify(r));
    expect(r.proposal.source).toBe("design");
    expect(r.proposal.assessments.map((a) => [a.title, a.kind, a.week, a.weight])).toEqual([
      ["Proeftoets SQL", "formative", 3, undefined],
      ["Ontwerp webwinkel", "summative", 8, 100],
    ]);
    expect(r.proposal.uncovered).toEqual([]);
    expect(recordUsage).toHaveBeenCalledOnce();
    const message = generate.mock.calls[0]![0].messages[0].content as string;
    expect(message).toContain("1. De student ontwerpt een datamodel. [create]");
    expect(message).toContain("   - De query klopt.");
    expect(message).toContain("<weeks>8</weeks>");
    expect(message).toContain("Kennistoets, Beroepsproduct");
    expect((await repo.getCourse("teacher-d", course.id))?.data.assessments).toEqual([]);
  });

  it("adds the ticked tests with their coverage through import-apply", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Apply 2", data: withOutcomes });
    const r = await post(course.id, [
      ["intent", "import-apply"],
      ["outcomeKey", "o1"],
      ["o1.text", "De student ontwerpt een datamodel."],
      ["outcomeKey", "o2"],
      ["o2.text", "De student schrijft SQL-queries."],
      ["assessmentKey", "a1"],
      ["a1.pick", "on"],
      ["a1.title", "Ontwerp webwinkel"],
      ["a1.kind", "summative"],
      ["a1.weight", "100"],
      ["a1.week", "8"],
      ["a1.outcomes", "o1"],
      ["a1.outcomes", "o2"],
      ["a1.extra", JSON.stringify({ details: { form: "Beroepsproduct" }, parts: [] })],
    ]);
    expect(r).toMatchObject({ ok: true, intent: "import-apply", added: { outcomes: 0 } });
    const data = (await repo.getCourse("teacher-d", course.id))?.data;
    expect(data?.outcomes).toHaveLength(2);
    expect(data?.assessments[0]).toMatchObject({ title: "Ontwerp webwinkel", weight: 100 });
    expect(data?.assessments[0]?.coverage.map((c) => c.outcomeId)).toEqual(["lo1", "lo2"]);
  });

  it("asks again with the teacher's remark on the earlier proposal", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Opnieuw", data: withOutcomes });
    generate.mockResolvedValueOnce({ text: programme, usage: { output: 80 } });
    const previous = JSON.stringify([
      { title: "Tentamen", kind: "summative", week: 8, weight: 100, outcomeRefs: [1, 2] },
    ]);
    const r = await post(
      course.id,
      assess([
        ["remark", "Liever een beroepsproduct dan een tentamen."],
        ["previous", previous],
      ]),
    );
    expect(r).toMatchObject({ ok: true, intent: "design-assessments" });
    const call = generate.mock.calls[0]![0];
    expect(call.system).toContain("<remark>");
    const message = call.messages[0].content as string;
    expect(message).toContain(
      "<previousProposal>\n1. Tentamen | summative | week 8 | weight 100 | outcomes 1, 2\n</previousProposal>",
    );
    expect(message).toContain("<remark>\nLiever een beroepsproduct dan een tentamen.\n</remark>");
  });

  it("keeps the Bloom level the teacher chose for each covered outcome", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Niveaus", data: withOutcomes });
    await post(course.id, [
      ["intent", "import-apply"],
      ["outcomeKey", "o1"],
      ["o1.text", "De student ontwerpt een datamodel."],
      ["outcomeKey", "o2"],
      ["o2.text", "De student schrijft SQL-queries."],
      ["assessmentKey", "a1"],
      ["a1.pick", "on"],
      ["a1.title", "Ontwerp webwinkel"],
      ["a1.kind", "summative"],
      ["a1.outcomes", "o1"],
      ["a1.outcomes", "o2"],
      ["a1.bloom.o1", "create"],
      ["a1.bloom.o2", "apply"],
    ]);
    const data = (await repo.getCourse("teacher-d", course.id))?.data;
    expect(data?.assessments[0]?.coverage).toEqual([
      { outcomeId: "lo1", bloom: "create" },
      { outcomeId: "lo2", bloom: "apply" },
    ]);
  });

  it("is refused without a model call for a course without outcomes or with tests", async () => {
    const empty = await repo.createCourse("teacher-d", { name: "Leeg" });
    const r = await post(empty.id, assess());
    expect(r).toMatchObject({ ok: false, intent: "design-assessments" });
    if (r.ok) return;
    expect(r.error).toMatch(/leeruitkomsten/);
    const tested = await repo.createCourse("teacher-d", {
      name: "Al getoetst",
      data: {
        ...withOutcomes,
        assessments: [{ id: "t1", title: "Toets", kind: "summative" as const, coverage: [] }],
      },
    });
    expect(await post(tested.id, assess())).toMatchObject({ ok: false });
    expect(
      await post(
        (await repo.createCourse("teacher-d", { name: "Te lang", data: withOutcomes })).id,
        assess([["forms", "x".repeat(501)]]),
      ),
    ).toMatchObject({ ok: false });
    expect(generate).not.toHaveBeenCalled();
  });

  it("says what the AI needs when it proposes no tests, and retries broken JSON once", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Niets", data: withOutcomes });
    generate.mockResolvedValueOnce({
      text: JSON.stringify({ assessments: [], notes: "Welke toetsvormen?" }),
    });
    expect(await post(course.id, assess())).toMatchObject({
      ok: false,
      intent: "design-assessments",
      notes: "Welke toetsvormen?",
    });
    generate.mockReset();
    generate.mockResolvedValue({ text: "{ kapot" });
    const r = await post(course.id, assess(), "en");
    expect(generate).toHaveBeenCalledTimes(2);
    if (r.ok) throw new Error("expected a failure");
    expect(r.error).toMatch(/test programme/i);
  });

  it("is a 404 when the admin switched the course wizard off", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Uit 2", data: withOutcomes });
    featureOff.add("courseDesign");
    const status = await post(course.id, assess()).then(
      () => undefined,
      (e) => (e instanceof Response ? e.status : -1),
    );
    expect(status).toBe(404);
    expect(generate).not.toHaveBeenCalled();
  });
});

const series = JSON.stringify({
  lessons: [
    {
      title: "Kennismaken met SQL",
      week: 1,
      kind: "lesson",
      goal: "De student schrijft een eerste SELECT-query.",
      outcomeRefs: [2],
      discipline: null,
    },
    {
      title: "Opdracht datamodel",
      week: 2,
      kind: "assignment",
      goal: "De student tekent een eerste datamodel.",
      outcomeRefs: [1],
      discipline: null,
    },
  ],
  notes: "Week 8 is de toetsweek.",
});
const withTests = {
  ...withOutcomes,
  schedule: { weeks: 8, sessionsPerWeek: 2 },
  assessments: [
    {
      id: "t1",
      title: "Ontwerp webwinkel",
      kind: "summative" as const,
      week: 8,
      weight: 100,
      coverage: [{ outcomeId: "lo1" }, { outcomeId: "lo2" }],
    },
  ],
};
const lessons = (extra: [string, string][] = []): [string, string][] => [
  ["intent", "design-lessons"],
  ...extra,
];

describe("design-lessons", () => {
  it("proposes lessons per week over the course's outcomes and tests, and stores nothing", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Lessen", data: withTests });
    generate.mockResolvedValueOnce({ text: series, usage: { output: 80 } });
    const r = await post(course.id, lessons([["wishes", "Week 4 is projectweek."]]));
    if (!r.ok || r.intent !== "design-lessons") throw new Error(JSON.stringify(r));
    expect(r.proposal.lessons.map((l) => [l.title, l.week, l.kind, l.outcomeIds])).toEqual([
      ["Kennismaken met SQL", 1, "lesson", ["lo2"]],
      ["Opdracht datamodel", 2, "assignment", ["lo1"]],
    ]);
    expect(r.proposal.untaught).toEqual([]);
    expect(recordUsage).toHaveBeenCalledOnce();
    const call = generate.mock.calls[0]![0];
    expect(call.system).toContain("Voice & Bounds");
    const message = call.messages[0].content as string;
    expect(message).toContain("<lessonsPerWeek>2</lessonsPerWeek>");
    expect(message).toContain("- Ontwerp webwinkel [summative, week 8]: 1, 2");
    expect(message).toContain("Week 4 is projectweek.");
    expect((await repo.getCourse("teacher-d", course.id))?.data.activities).toEqual([]);
  });

  it("keeps the weeks and sessions the teacher typed where the schedule was empty", async () => {
    const course = await repo.createCourse("teacher-d", {
      name: "Rooster",
      data: { ...withTests, schedule: undefined },
    });
    generate.mockResolvedValueOnce({ text: series });
    await post(
      course.id,
      lessons([
        ["weeks", "10"],
        ["sessionsPerWeek", "3"],
      ]),
    );
    const message = generate.mock.calls[0]![0].messages[0].content as string;
    expect(message).toContain("<weeks>10</weeks>");
    expect(message).toContain("<lessonsPerWeek>3</lessonsPerWeek>");
    expect((await repo.getCourse("teacher-d", course.id))?.data.schedule).toEqual({
      weeks: 10,
      sessionsPerWeek: 3,
    });
  });

  it("adds the ticked lessons through design-lessons-apply", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Toepassen", data: withTests });
    const r = await post(course.id, [
      ["intent", "design-lessons-apply"],
      ["lessonKey", "l1"],
      ["l1.pick", "on"],
      ["l1.title", "Kennismaken met SQL"],
      ["l1.week", "1"],
      ["l1.kind", "lesson"],
      ["l1.goal", "De student schrijft een eerste SELECT-query."],
      ["l1.outcomes", "lo2"],
      ["lessonKey", "l2"],
      ["l2.title", "Niet gekozen"],
      ["l2.kind", "lesson"],
    ]);
    expect(r).toMatchObject({ ok: true, intent: "design-lessons-apply", added: 1 });
    const data = (await repo.getCourse("teacher-d", course.id))?.data;
    expect(data?.activities).toHaveLength(1);
    expect(data?.activities[0]).toMatchObject({
      title: "Kennismaken met SQL",
      week: 1,
      goal: "De student schrijft een eerste SELECT-query.",
      outcomeIds: ["lo2"],
    });
  });

  it("refuses an apply with an outcome that is not the course's", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Vreemd", data: withTests });
    const r = await post(course.id, [
      ["intent", "design-lessons-apply"],
      ["lessonKey", "l1"],
      ["l1.pick", "on"],
      ["l1.title", "Les"],
      ["l1.kind", "lesson"],
      ["l1.outcomes", "lo-van-een-ander"],
    ]);
    expect(r).toMatchObject({ ok: false, intent: "design-lessons-apply" });
    expect((await repo.getCourse("teacher-d", course.id))?.data.activities).toEqual([]);
  });

  it("is refused without a model call for a course without tests, or with lessons", async () => {
    const noTests = await repo.createCourse("teacher-d", {
      name: "Geen toetsen",
      data: withOutcomes,
    });
    const r = await post(noTests.id, lessons());
    expect(r).toMatchObject({ ok: false, intent: "design-lessons" });
    if (r.ok) return;
    expect(r.error).toMatch(/toetsen/);
    const taught = await repo.createCourse("teacher-d", {
      name: "Al lessen",
      data: {
        ...withTests,
        activities: [{ id: "x", title: "Les", kind: "lesson" as const, outcomeIds: [] }],
      },
    });
    expect(await post(taught.id, lessons())).toMatchObject({ ok: false });
    const course = await repo.createCourse("teacher-d", { name: "Te lang 3", data: withTests });
    expect(await post(course.id, lessons([["wishes", "x".repeat(501)]]))).toMatchObject({
      ok: false,
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("says what the AI needs when it proposes no lessons, and retries broken JSON once", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Niets 3", data: withTests });
    generate.mockResolvedValueOnce({
      text: JSON.stringify({ lessons: [], notes: "Hoeveel lesmomenten per week?" }),
    });
    expect(await post(course.id, lessons())).toMatchObject({
      ok: false,
      intent: "design-lessons",
      notes: "Hoeveel lesmomenten per week?",
    });
    generate.mockReset();
    generate.mockResolvedValue({ text: "{ kapot" });
    const r = await post(course.id, lessons(), "en");
    expect(generate).toHaveBeenCalledTimes(2);
    if (r.ok) throw new Error("expected a failure");
    expect(r.error).toMatch(/lesson series/i);
  });

  it("is a 404 when the admin switched the course wizard off", async () => {
    const course = await repo.createCourse("teacher-d", { name: "Uit 3", data: withTests });
    featureOff.add("courseDesign");
    const status = await post(course.id, lessons()).then(
      () => undefined,
      (e) => (e instanceof Response ? e.status : -1),
    );
    expect(status).toBe(404);
    expect(generate).not.toHaveBeenCalled();
  });
});
