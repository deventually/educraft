import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { sampleDossier, C1, C2, LU } from "../portfolio/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let repo: typeof import("~/server/repositories/portfolio.server");
let overview: typeof import("~/routes/portfolio.$id");
let outcome: typeof import("~/routes/portfolio.$id.outcome.$outcomeId");
let generations: typeof import("~/server/repositories/generations.server");

beforeAll(async () => {
  repo = await import("~/server/repositories/portfolio.server");
  overview = await import("~/routes/portfolio.$id");
  outcome = await import("~/routes/portfolio.$id.outcome.$outcomeId");
  generations = await import("~/server/repositories/generations.server");
});

beforeEach(async () => {
  await signInAs({ id: "teacher-a", name: "A" });
});

function post(fields: Record<string, string | string[]>): Request {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    for (const value of Array.isArray(v) ? v : [v]) body.append(k, value);
  }
  return signedRequest("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: body.toString(),
  });
}
const get = () => signedRequest("http://localhost/x", { headers: { Cookie: "lang=nl" } });

/** A confirmed dossier whose first criterion is about lesson design; no evidence yet. */
async function dossier(userId = "teacher-a") {
  const d = sampleDossier();
  d.framework.confirmedAt = 1;
  d.framework.outcomes[0]!.criteria[0]!.text = "Je maakt een lesontwerp met een heldere opbouw.";
  d.evidence = [];
  return repo.createDossier(userId, "Mijn BDB", d);
}

const lessonPlan = (userId: string) =>
  generations.saveGeneration({
    userId,
    toolSlug: "lesson-plan",
    input: {},
    outputMarkdown: "# Lesopzet\n\nInhoud.",
    model: "test",
    outputLanguage: "nl",
  } as never);

describe("Dit heb je misschien al", () => {
  it("suggests the teacher's own earlier lesson plan at a lesson-design criterion", async () => {
    const mine = await dossier();
    const g = await lessonPlan("teacher-a");
    await lessonPlan("teacher-b");
    const data = await outcome.loader({
      request: get(),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(data.suggestions[C1]).toEqual([
      expect.objectContaining({ generationId: g.id, toolName: "Les voorbereiden" }),
    ]);
    // Another teacher's work is never suggested (the first test runs on a clean DB).
    expect(data.suggestions[C2]).toBeUndefined();
  });

  it("puts the ticked work at the criterion, once", async () => {
    const mine = await dossier();
    const g = await lessonPlan("teacher-a");
    const r = await outcome.action({
      request: post({ intent: "adoptSuggestions", criterionId: C1, generationIds: [g.id] }),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(r).toMatchObject({ ok: true, intent: "adoptSuggestions" });
    const evidence = (await repo.getDossier("teacher-a", mine.id))?.data.evidence ?? [];
    expect(evidence).toEqual([
      expect.objectContaining({
        title: "Les voorbereiden",
        text: "# Lesopzet\n\nInhoud.",
        criterionIds: [C1],
        sourceGenerationId: g.id,
      }),
    ]);
    const after = await outcome.loader({
      request: get(),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    const still = (after.suggestions[C1] ?? []).map((x) => x.generationId);
    expect(still).not.toContain(g.id);
  });

  it("writes nothing for someone else's generation", async () => {
    const mine = await dossier();
    const theirs = await lessonPlan("teacher-b");
    const r = await outcome.action({
      request: post({ intent: "adoptSuggestions", criterionId: C1, generationIds: [theirs.id] }),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(r).toMatchObject({ ok: false });
    expect((await repo.getDossier("teacher-a", mine.id))?.data.evidence).toEqual([]);
  });

  it("refuses an unknown criterion", async () => {
    const mine = await dossier();
    const g = await lessonPlan("teacher-a");
    const r = await outcome.action({
      request: post({ intent: "adoptSuggestions", criterionId: LU, generationIds: [g.id] }),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(r).toMatchObject({ ok: false });
    expect((await repo.getDossier("teacher-a", mine.id))?.data.evidence).toEqual([]);
  });
});

describe("the route in five steps", () => {
  it("tells the overview which step the dossier is at", async () => {
    const mine = await dossier();
    const data = await overview.loader({ request: get(), params: { id: mine.id } } as never);
    expect(data.step).toBe("collect");
  });
});
