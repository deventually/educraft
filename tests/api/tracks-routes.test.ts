import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let list: typeof import("~/routes/tracks._index");
let detail: typeof import("~/routes/tracks.$id");
let toolRoute: typeof import("~/routes/tool");
let start: typeof import("~/routes/start");
let repo: typeof import("~/server/repositories/tracks.server");
let generations: typeof import("~/server/repositories/generations.server");
let courses: typeof import("~/server/repositories/courses.server");
let models: typeof import("~/server/repositories/assessmentModels.server");
let exceptions: typeof import("~/server/repositories/exceptions.server");

const A = "tr-a";
const B = "tr-b";
const OFF = "tr-off";

beforeAll(async () => {
  list = await import("~/routes/tracks._index");
  detail = await import("~/routes/tracks.$id");
  toolRoute = await import("~/routes/tool");
  start = await import("~/routes/start");
  repo = await import("~/server/repositories/tracks.server");
  generations = await import("~/server/repositories/generations.server");
  courses = await import("~/server/repositories/courses.server");
  models = await import("~/server/repositories/assessmentModels.server");
  exceptions = await import("~/server/repositories/exceptions.server");
  // The part is off for everyone; the admin puts it on request, then on for A and B.
  const settings = await import("~/server/repositories/settings.server");
  await settings.setFeatureStand("supervisionTracks", "request");
  for (const id of [A, B]) {
    await signInAs({ id });
    await exceptions.setException(id, exceptions.featureKey("supervisionTracks"), "on");
  }
  await signInAs({ id: OFF });
});

beforeEach(() => signInAs({ id: A }));

function post(path: string, fields: Record<string, string>): Request {
  return signedRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: new URLSearchParams(fields).toString(),
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

async function track(userId = A, code = "S-0423") {
  const t = await repo.createTrack(userId, { code, kind: "internship" });
  if (!t) throw new Error("no track");
  return t;
}

describe("/tracks while the part is off", () => {
  it("is a 404 for the list, a track and the actions", async () => {
    await signInAs({ id: OFF });
    expect(await status(list.loader({ request: get("/tracks") } as never))).toBe(404);
    expect(
      await status(list.action({ request: post("/tracks", { intent: "create" }) } as never)),
    ).toBe(404);
    expect(
      await status(detail.loader({ request: get("/tracks/x"), params: { id: "x" } } as never)),
    ).toBe(404);
  });

  it("shows no block on Start", async () => {
    await signInAs({ id: OFF });
    const data = (await start.loader({ request: get("/start") } as never)) as {
      supervision: unknown;
    };
    expect(data.supervision).toBeNull();
  });
});

describe("/tracks list", () => {
  it("creates a track with an own course and model and opens it", async () => {
    const course = await courses.createCourse(A, { name: "Stage jaar 3" });
    const model = await models.createAssessmentModel(A, "Stageplan HBO-i", {
      documentTypes: ["stageplan"],
      framework: "C1 Probleemstelling",
      scale: "",
    });
    const r = (await list.action({
      request: post("/tracks", {
        intent: "create",
        code: " S-0001 ",
        kind: "internship",
        courseId: course.id,
        assessmentModelId: model.id,
      }),
    } as never)) as Response;
    const id = (r.headers.get("Location") ?? "").match(/^\/tracks\/([^/?]+)$/)?.[1] ?? "";
    expect(await repo.getTrack(A, id)).toMatchObject({
      code: "S-0001",
      courseId: course.id,
      assessmentModelId: model.id,
    });
  });

  it("refuses an empty code, an unknown kind and a colleague's course with an error", async () => {
    const theirs = await courses.createCourse(B, { name: "Van B" });
    for (const fields of [
      { code: " ", kind: "internship" },
      { code: "S-1", kind: "minor" },
      { code: "S-1", kind: "thesis", courseId: theirs.id },
    ]) {
      const r = (await list.action({
        request: post("/tracks", { intent: "create", ...fields } as Record<string, string>),
      } as never)) as { ok: boolean; error?: string };
      expect(r.ok).toBe(false);
      expect(r.error).toBeTruthy();
    }
  });

  it("lists only own tracks with their next step, and the models for the form", async () => {
    await models.createAssessmentModel(A, "Essaymodel", {
      documentTypes: ["essay"],
      framework: "C1",
      scale: "",
    });
    const mine = await track(A, "S-LIST");
    const theirs = await track(B, "S-THEIRS");
    const data = (await list.loader({ request: get("/tracks") } as never)) as {
      tracks: { id: string; code: string; next: { milestone: string } | null }[];
      models: { name: string }[];
    };
    expect(data.tracks.find((t) => t.id === mine.id)?.next?.milestone).toBe("start");
    expect(data.tracks.map((t) => t.id)).not.toContain(theirs.id);
    // Only models for an internship or thesis document.
    expect(data.models.map((m) => m.name)).not.toContain("Essaymodel");
  });

  it("wipes an own track now, and not a colleague's", async () => {
    const mine = await track();
    const theirs = await track(B);
    await list.action({ request: post("/tracks", { intent: "delete", id: mine.id }) } as never);
    await list.action({ request: post("/tracks", { intent: "delete", id: theirs.id }) } as never);
    expect(await repo.getTrack(A, mine.id)).toBeNull();
    expect(await repo.getTrack(B, theirs.id)).not.toBeNull();
  });
});

describe("/tracks/:id", () => {
  it("loads an own track with its rounds; a colleague's is a 404", async () => {
    const t = await track();
    await repo.addRound(A, t.id, {
      milestone: "start",
      redactedText: "",
      feedback: { text: "Sterk plan." },
    });
    const data = (await detail.loader({
      request: get(`/tracks/${t.id}?tab=start`),
      params: { id: t.id },
    } as never)) as { tab: string; rounds: { feedback: { text: string } }[] };
    expect(data.tab).toBe("start");
    expect(data.rounds[0]?.feedback.text).toBe("Sterk plan.");
    const theirs = await track(B);
    expect(
      await status(
        detail.loader({ request: get(`/tracks/${theirs.id}`), params: { id: theirs.id } } as never),
      ),
    ).toBe(404);
  });

  it("an unknown tab falls back to the overview", async () => {
    const t = await track();
    const data = (await detail.loader({
      request: get(`/tracks/${t.id}?tab=nope`),
      params: { id: t.id },
    } as never)) as { tab: string };
    expect(data.tab).toBe("overview");
  });

  it("sets a milestone's status and hand-in date, and refuses nonsense", async () => {
    const t = await track();
    const ok = (await detail.action({
      request: post(`/tracks/${t.id}`, {
        intent: "milestone",
        milestone: "start",
        status: "done",
        due: "2027-02-01",
      }),
      params: { id: t.id },
    } as never)) as { ok: boolean };
    expect(ok.ok).toBe(true);
    expect((await repo.getTrack(A, t.id))?.data).toEqual({
      status: { start: "done" },
      deadlines: { start: "2027-02-01" },
      visits: [],
      onstage: [],
    });
    const bad = (await detail.action({
      request: post(`/tracks/${t.id}`, { intent: "milestone", milestone: "start", status: "x" }),
      params: { id: t.id },
    } as never)) as { ok: boolean };
    expect(bad.ok).toBe(false);
    // Clearing the date removes it.
    await detail.action({
      request: post(`/tracks/${t.id}`, {
        intent: "milestone",
        milestone: "start",
        status: "open",
        due: "",
      }),
      params: { id: t.id },
    } as never);
    expect((await repo.getTrack(A, t.id))?.data.deadlines).toEqual({});
  });

  it("a colleague cannot change a track", async () => {
    const t = await track();
    await signInAs({ id: B });
    expect(
      await status(
        detail.action({
          request: post(`/tracks/${t.id}`, {
            intent: "milestone",
            milestone: "start",
            status: "done",
          }),
          params: { id: t.id },
        } as never),
      ),
    ).toBe(404);
    expect((await repo.getTrack(A, t.id))?.data.status).toEqual({});
  });
});

describe("milestone 1 through Studentwerk beoordelen", () => {
  const SLUG = "stage-assessment";
  const load = (query: string) =>
    toolRoute.loader({
      request: get(`/tools/${SLUG}${query}`),
      params: { slug: SLUG },
      context: {},
    } as never) as Promise<{
      forTrack: {
        trackId: string;
        code: string;
        milestone: string;
        feedbackHistory: string;
        criteria: string;
        weakPoints: string;
      } | null;
    }>;
  const act = (fields: Record<string, string>) =>
    toolRoute.action({
      request: post(`/tools/${SLUG}`, fields),
      params: { slug: SLUG },
      context: {},
    } as never) as Promise<{ ok: boolean; intent?: string }>;
  const saved = (userId: string) =>
    generations.saveGeneration({
      userId,
      toolSlug: SLUG,
      input: { document: "[NAAM] schreef een plan." },
      outputMarkdown: "## Feedback\nSterk: de aanleiding.",
      model: "test",
      outputLanguage: "nl",
    });

  it("the tool opened from an own track knows the track and the milestone", async () => {
    const t = await track(A, "S-TOOL");
    expect((await load(`?track=${t.id}&milestone=start`)).forTrack).toMatchObject({
      trackId: t.id,
      code: "S-TOOL",
      milestone: "start",
    });
    expect((await load(`?track=${t.id}&milestone=nope`)).forTrack).toBeNull();
    // P38.4: the earlier feedback of the track goes along, for the final assessment.
    await repo.addRound(A, t.id, {
      milestone: "drafts",
      redactedText: "",
      feedback: { text: "Noem bronnen." },
    });
    const final = (await load(`?track=${t.id}&milestone=final`)).forTrack;
    expect(final).toMatchObject({ milestone: "final" });
    expect(final?.feedbackHistory).toBe("### Concepten, ronde 1\nNoem bronnen.");
    // P38.6: the criteria of the linked model (none here) and the weak points go along too.
    expect(final).toMatchObject({ criteria: "", weakPoints: "" });
    const theirs = await track(B);
    expect((await load(`?track=${theirs.id}&milestone=start`)).forTrack).toBeNull();
  });

  it("keeps the feedback (not the report) as a round in the track", async () => {
    const t = await track();
    const g = await saved(A);
    const r = await act({ intent: "addToTrack", id: g.id, trackId: t.id, milestone: "start" });
    expect(r).toEqual({ ok: true, intent: "addToTrack" });
    const rounds = await repo.listRounds(A, t.id);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({
      milestone: "start",
      round: 1,
      redactedText: "",
      feedback: { text: "## Feedback\nSterk: de aanleiding." },
    });
  });

  it("refuses to add to a closed track", async () => {
    const t = await track();
    await repo.closeTrack(A, t.id);
    const g = await saved(A);
    expect(
      (await act({ intent: "addToTrack", id: g.id, trackId: t.id, milestone: "start" })).ok,
    ).toBe(false);
    expect(await repo.listRounds(A, t.id)).toEqual([]);
  });

  it("refuses a colleague's work or track, and anything while the part is off", async () => {
    const t = await track();
    const theirWork = await saved(B);
    expect(
      (await act({ intent: "addToTrack", id: theirWork.id, trackId: t.id, milestone: "start" })).ok,
    ).toBe(false);
    const theirs = await track(B);
    const mine = await saved(A);
    expect(
      (await act({ intent: "addToTrack", id: mine.id, trackId: theirs.id, milestone: "start" })).ok,
    ).toBe(false);
    await signInAs({ id: OFF });
    const offWork = await saved(OFF);
    expect(
      (await act({ intent: "addToTrack", id: offWork.id, trackId: t.id, milestone: "start" })).ok,
    ).toBe(false);
    expect(await repo.listRounds(A, t.id)).toEqual([]);
    expect(await repo.listRounds(B, theirs.id)).toEqual([]);
  });
});

describe("Mijn begeleiding on Start", () => {
  it("lists the open tracks with their next step", async () => {
    const t = await track(A, "S-START");
    const data = (await start.loader({ request: get("/start") } as never)) as {
      supervision: { tracks: { id: string; code: string; next: { milestone: string } | null }[] };
    };
    expect(data.supervision.tracks.find((x) => x.id === t.id)).toMatchObject({
      code: "S-START",
      next: { milestone: "start", due: null },
    });
  });
});
