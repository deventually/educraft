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
