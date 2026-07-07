import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// Isolated in-memory SQLite + small abuse budgets, set before any server module
// loads. DAILY_REQUEST_LIMIT is low so the quota path is cheap to drain; the
// rate-limit test uses an admin (quota-exempt) so the two never collide.
process.env.DATABASE_URL = "file::memory:";
process.env.DAILY_REQUEST_LIMIT = "2";
process.env.RATE_LIMIT_PER_MINUTE = "5";

// Replace the real provider so no model call happens; the spy captures the
// (system, messages, model, maxTokens) the route resolves.
const { streamChatSpy } = vi.hoisted(() => ({ streamChatSpy: vi.fn() }));
vi.mock("~/lib/ai/provider", () => ({
  providerForModel: vi.fn(() => ({ id: "mock", generate: vi.fn(), streamChat: streamChatSpy })),
}));

// Stub auth: id from `x-test-user`, role from `x-test-role` (default teacher).
// Individual tests override for the anonymous, student, and stale-session cases.
const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ getUser: getUserMock }));

// Stub the two save paths so we can assert which one the route takes (and inject
// a save failure) without depending on the generations schema.
const { saveGenerationSpy, upsertChatSpy } = vi.hoisted(() => ({
  saveGenerationSpy: vi.fn(),
  upsertChatSpy: vi.fn(),
}));
vi.mock("~/server/repositories/generations.server", () => ({
  saveGeneration: saveGenerationSpy,
  upsertChatGeneration: upsertChatSpy,
}));
const { recordChatTurnSpy } = vi.hoisted(() => ({ recordChatTurnSpy: vi.fn() }));
vi.mock("~/server/repositories/chat.server", () => ({ recordChatTurn: recordChatTurnSpy }));

type ActionMod = typeof import("~/routes/api.stream");
let action: ActionMod["action"];
let m: Awaited<ReturnType<typeof import("~/lib/i18n").getMessages>>;
let cohorts: typeof import("~/server/repositories/cohorts.server");
let profiles: typeof import("~/server/repositories/profiles.server");
let users: typeof import("~/server/repositories/users.server");
let settings: typeof import("~/server/repositories/settings.server");
let realAuth: typeof import("~/server/auth.server");
let resolveModelInfo: typeof import("~/lib/ai/models").resolveModelInfo;
let sseStream: typeof import("~/lib/ai/sse").sseStream;
let defaultValuesFor: typeof import("~/lib/forms/values").defaultValuesFor;
let toTemplateValues: typeof import("~/lib/forms/values").toTemplateValues;
let getToolBySlug: typeof import("~/lib/registry").getToolBySlug;

beforeAll(async () => {
  ({ action } = await import("~/routes/api.stream"));
  const i18n = await import("~/lib/i18n");
  m = i18n.getMessages("nl");
  cohorts = await import("~/server/repositories/cohorts.server");
  profiles = await import("~/server/repositories/profiles.server");
  users = await import("~/server/repositories/users.server");
  settings = await import("~/server/repositories/settings.server");
  realAuth = await vi.importActual("~/server/auth.server");
  ({ resolveModelInfo } = await import("~/lib/ai/models"));
  ({ sseStream } = await import("~/lib/ai/sse"));
  ({ defaultValuesFor, toTemplateValues } = await import("~/lib/forms/values"));
  ({ getToolBySlug } = await import("~/lib/registry"));
});

beforeEach(() => {
  streamChatSpy.mockReset();
  streamChatSpy.mockImplementation(async function* () {
    yield "ok";
  });
  saveGenerationSpy.mockReset().mockResolvedValue({});
  upsertChatSpy.mockReset().mockResolvedValue({});
  recordChatTurnSpy.mockReset().mockResolvedValue(undefined);
  getUserMock.mockReset();
  getUserMock.mockImplementation(async (request: Request) => ({
    id: request.headers.get("x-test-user") ?? "anon",
    name: "Test User",
    email: null,
    role: (request.headers.get("x-test-role") ?? "teacher") as "teacher" | "admin" | "student",
    createdAt: new Date(0),
  }));
});

// ── helpers ─────────────────────────────────────────────────────────────────

interface InvokeOpts {
  userId?: string;
  role?: string;
  cookie?: string;
  headers?: Record<string, string>;
}

function makeRequest(body: unknown, opts: InvokeOpts = {}): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...opts.headers };
  if (opts.userId) headers["x-test-user"] = opts.userId;
  if (opts.role) headers["x-test-role"] = opts.role;
  if (opts.cookie) headers.Cookie = opts.cookie;
  return new Request("http://localhost/api/stream", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function invoke(body: unknown, opts?: InvokeOpts): Promise<Response> {
  return action({ request: makeRequest(body, opts) } as Parameters<typeof action>[0]);
}

/** The message of an `event: error` SSE frame, or null. */
function sseErrorMessage(text: string): string | null {
  const match = /event: error\ndata: (.*)/.exec(text);
  if (!match) return null;
  try {
    return JSON.parse(match[1]).message as string;
  } catch {
    return null;
  }
}

/** Token deltas from `data: {"t":"…"}` frames, in stream order. */
function sseTokens(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(/data: (\{"t":.*?\})\n\n/g)) {
    out.push(JSON.parse(match[1]).t);
  }
  return out;
}

/** All template placeholders resolved, so buildSystemPrompt never throws. */
function fullValues(slug: string): Record<string, unknown> {
  return toTemplateValues(defaultValuesFor(getToolBySlug(slug)!.inputs));
}

function asUser(id: string, role: "student" | "teacher" | "admin") {
  getUserMock.mockResolvedValue({
    id,
    name: `Test ${role}`,
    email: null,
    role,
    createdAt: new Date(0),
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Happy paths — the three interaction modes
// ════════════════════════════════════════════════════════════════════════════

describe("api.stream — mode happy paths", () => {
  it("one-shot: builds a single trigger message + the language directive, no reinforcement", async () => {
    await invoke(
      { slug: "authentic-assessment", values: fullValues("authentic-assessment") },
      { userId: "one-shot-nl" },
    );
    expect(streamChatSpy).toHaveBeenCalledTimes(1);
    const { system, messages } = streamChatSpy.mock.calls[0][0];
    expect(messages).toEqual([{ role: "user", content: "Voer de opdracht volledig uit." }]);
    // One-shot never applies the last-turn language reminder (that is chat-only).
    expect(messages[0].content).not.toContain("[Belangrijk");
    expect(system).toContain("antwoord altijd volledig in het Nederlands");
  });

  it("one-shot: honours an English output language in the trigger + directive", async () => {
    await invoke(
      {
        slug: "authentic-assessment",
        values: fullValues("authentic-assessment"),
        outputLanguage: "en",
      },
      { userId: "one-shot-en" },
    );
    const { system, messages } = streamChatSpy.mock.calls[0][0];
    expect(messages[0].content).toBe("Carry out the task in full.");
    expect(system).toContain("always respond entirely in English");
  });

  it("chat: forwards the history and reinforces the language on the LAST turn only", async () => {
    const history = [
      { role: "user", content: "eerste" },
      { role: "assistant", content: "antwoord" },
      { role: "user", content: "laatste" },
    ];
    await invoke(
      {
        slug: "socratic-partner",
        values: { chapter: "Evolutie" },
        messages: history,
        outputLanguage: "en",
      },
      { userId: "chat-happy" },
    );
    const { messages } = streamChatSpy.mock.calls[0][0];
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe("eerste"); // untouched
    expect(messages[1].content).toBe("antwoord"); // untouched
    expect(messages[2].content).toContain("laatste");
    expect(messages[2].content).toContain("always respond entirely in English"); // reinforced
  });

  it("multi-stage: injects the consumed prior-stage output under its placeholder", async () => {
    await invoke(
      {
        slug: "cognitive-architect",
        stageId: "generator",
        values: fullValues("cognitive-architect"),
        priorOutputs: { analyst: "THE-COORDINATES-DOC" },
      },
      { userId: "multi-stage" },
    );
    expect(streamChatSpy).toHaveBeenCalledTimes(1);
    expect(streamChatSpy.mock.calls[0][0].system).toContain("THE-COORDINATES-DOC");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Persistence branches
// ════════════════════════════════════════════════════════════════════════════

describe("api.stream — persistence", () => {
  it("one-shot completion saves a generation (not a chat upsert)", async () => {
    const res = await invoke(
      { slug: "authentic-assessment", values: fullValues("authentic-assessment") },
      { userId: "persist-oneshot" },
    );
    await res.text(); // consume → onComplete
    expect(saveGenerationSpy).toHaveBeenCalledTimes(1);
    expect(saveGenerationSpy.mock.calls[0][0].outputMarkdown).toBe("ok");
    expect(upsertChatSpy).not.toHaveBeenCalled();
  });

  it("chat completion with a valid sessionId upserts one row with the rebuilt transcript", async () => {
    const sessionId = "session-abcdefgh"; // 8–100 chars
    const res = await invoke(
      {
        slug: "socratic-partner",
        values: { chapter: "Evolutie" },
        messages: [{ role: "user", content: "hoi" }],
        sessionId,
      },
      { userId: "persist-chat" },
    );
    await res.text();
    expect(upsertChatSpy).toHaveBeenCalledTimes(1);
    const arg = upsertChatSpy.mock.calls[0][0];
    expect(arg.id).toBe(sessionId);
    expect(typeof arg.transcript).toBe("string");
    expect(arg.transcript).toContain("ok"); // the assistant's completed reply
    expect(recordChatTurnSpy).toHaveBeenCalledTimes(1);
    expect(saveGenerationSpy).not.toHaveBeenCalled();
  });

  it("a save failure is caught and never kills the stream", async () => {
    saveGenerationSpy.mockRejectedValueOnce(new Error("db down"));
    const res = await invoke(
      { slug: "authentic-assessment", values: fullValues("authentic-assessment") },
      { userId: "persist-fail" },
    );
    const text = await res.text();
    // Tokens streamed and the stream completed normally — no error frame.
    expect(sseTokens(text)).toEqual(["ok"]);
    expect(text).toContain("event: done");
    expect(sseErrorMessage(text)).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Refusal paths — each returns a localized SSE error and never calls the provider
// (5.1 lists 13; every one is covered below and counted in this block)
// ════════════════════════════════════════════════════════════════════════════

describe("api.stream — refusals (localized SSE, no provider call)", () => {
  it("[1] unknown slug → unknownTool", async () => {
    const res = await invoke({ slug: "no-such-tool", values: {} }, { userId: "r-unknown" });
    expect(sseErrorMessage(await res.text())).toBe(m.error.unknownTool);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("[2] unauthenticated → unauthorized", async () => {
    getUserMock.mockResolvedValueOnce(null);
    const res = await invoke({ slug: "socratic-partner", values: { chapter: "x" } });
    expect(sseErrorMessage(await res.text())).toBe(m.error.unauthorized);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("[3] role not allowed: a student cannot drive an instructor tool", async () => {
    asUser("r-role-student", "student"); // no cohort → all student tools, but not instructor ones
    const res = await invoke({
      slug: "cognitive-architect",
      values: fullValues("cognitive-architect"),
    });
    expect(sseErrorMessage(await res.text())).toBe(m.error.notAllowed);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("[4] instance-disabled tool → notAllowed", async () => {
    await settings.setToolSetting("socratic-partner", { enabled: false });
    const res = await invoke(
      { slug: "socratic-partner", values: { chapter: "x" } },
      { userId: "r-disabled" },
    );
    expect(sseErrorMessage(await res.text())).toBe(m.error.notAllowed);
    expect(streamChatSpy).not.toHaveBeenCalled();
    await settings.setToolSetting("socratic-partner", { enabled: true }); // reset
  });

  it("[5a] non-JSON body → invalidRequest", async () => {
    const res = await invoke("this is not json{", { userId: "r-nonjson" });
    expect(sseErrorMessage(await res.text())).toBe(m.error.invalidRequest);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("[5b] body missing slug → invalidRequest", async () => {
    const res = await invoke({ values: {} }, { userId: "r-noslug" });
    expect(sseErrorMessage(await res.text())).toBe(m.error.invalidRequest);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("[5c] oversized declared content-length → invalidRequest", async () => {
    const res = await invoke(
      { slug: "socratic-partner", values: { chapter: "x" } },
      { userId: "r-clen", headers: { "content-length": String(26 * 1024 * 1024) } },
    );
    expect(sseErrorMessage(await res.text())).toBe(m.error.invalidRequest);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("[6] a form value over the per-field cap → invalidRequest", async () => {
    const res = await invoke(
      { slug: "socratic-partner", values: { chapter: "x".repeat(30_000) } },
      { userId: "r-bigvalue" },
    );
    expect(sseErrorMessage(await res.text())).toBe(m.error.invalidRequest);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("[7] a messages array beyond the maximum → invalidRequest", async () => {
    const messages = Array.from({ length: 101 }, () => ({ role: "user", content: "hi" }));
    const res = await invoke(
      { slug: "socratic-partner", values: { chapter: "x" }, messages },
      { userId: "r-manymsg" },
    );
    expect(sseErrorMessage(await res.text())).toBe(m.error.invalidRequest);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("[8] images to a non-vision model → modelNoVision", async () => {
    const res = await invoke(
      {
        slug: "math-grading",
        values: fullValues("math-grading"),
        model: "claude-code", // client-selectable but non-vision
        images: [{ mediaType: "image/png", dataBase64: "iVBORw0KGgo=" }],
      },
      { userId: "r-vision" },
    );
    const expected = m.error.modelNoVision.replace(
      "{model}",
      resolveModelInfo("claude-code").displayName,
    );
    expect(sseErrorMessage(await res.text())).toBe(expected);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("[9] rate-limited past the per-minute budget (admin, quota-exempt) → rateLimited", async () => {
    const admin = "r-rate-admin";
    for (let i = 0; i < 5; i++) {
      const res = await invoke(
        { slug: "authentic-assessment", values: fullValues("authentic-assessment") },
        { userId: admin, role: "admin" },
      );
      await res.text(); // release the concurrency slot
    }
    expect(streamChatSpy).toHaveBeenCalledTimes(5);
    const res = await invoke(
      { slug: "authentic-assessment", values: fullValues("authentic-assessment") },
      { userId: admin, role: "admin" },
    );
    expect(sseErrorMessage(await res.text())).toBe(m.error.rateLimited);
    expect(streamChatSpy).toHaveBeenCalledTimes(5); // 6th never reached the provider
  });

  it("[10] over the daily quota (non-admin) → quotaExceeded", async () => {
    const teacher = "r-quota";
    for (let i = 0; i < 2; i++) {
      const res = await invoke(
        { slug: "authentic-assessment", values: fullValues("authentic-assessment") },
        { userId: teacher },
      );
      await res.text(); // consume → recordUsage
    }
    expect(streamChatSpy).toHaveBeenCalledTimes(2);
    const res = await invoke(
      { slug: "authentic-assessment", values: fullValues("authentic-assessment") },
      { userId: teacher },
    );
    expect(sseErrorMessage(await res.text())).toBe(m.error.quotaExceeded);
    expect(streamChatSpy).toHaveBeenCalledTimes(2);
  });

  it("[11] a student tool outside the cohort allow-list → notAllowed (P6)", async () => {
    const student = "r-cohort-allow";
    const cohort = await cohorts.createCohort({
      createdByUserId: "teacher-allow",
      name: "Allow only mentorai",
      allowedToolSlugs: ["mentorai"],
    });
    await cohorts.addMembership(cohort.id, student);
    asUser(student, "student");
    // socratic-partner is a student tool but NOT in the cohort's allow-list.
    const res = await invoke({ slug: "socratic-partner", values: { chapter: "x" } });
    expect(sseErrorMessage(await res.text())).toBe(m.error.notAllowed);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("[12] an inactive cohort → cohortInactive (P6)", async () => {
    const student = "r-cohort-inactive";
    const cohort = await cohorts.createCohort({
      createdByUserId: "teacher-inactive",
      name: "Expired",
      allowedToolSlugs: ["socratic-partner"],
      activeUntil: new Date(Date.now() - 86_400_000), // yesterday
    });
    await cohorts.addMembership(cohort.id, student);
    asUser(student, "student");
    const res = await invoke({ slug: "socratic-partner", values: { chapter: "x" } });
    expect(sseErrorMessage(await res.text())).toBe(m.error.cohortInactive);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("[13] a stale sessionVersion cookie is treated as unauthenticated (P6.7)", async () => {
    // Real getUser + real session cookies for this one test.
    getUserMock.mockImplementation((req: Request) => realAuth.getUser(req));
    const u = await users.createUser({
      name: "Stale Session",
      email: "stale@example.com",
      passwordHash: "scrypt:aa:bb",
      role: "teacher",
    });
    const staleCookie = (await realAuth.createUserSession(u.id, "/")).headers
      .get("Set-Cookie")!
      .split(";")[0];
    // A second login bumps the DB sessionVersion, invalidating the first cookie.
    await realAuth.createUserSession(u.id, "/");

    const res = await invoke(
      { slug: "authentic-assessment", values: fullValues("authentic-assessment") },
      { cookie: staleCookie },
    );
    expect(sseErrorMessage(await res.text())).toBe(m.error.unauthorized);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Model allow-list + maxTokens (ported from stream-validation/availability)
// ════════════════════════════════════════════════════════════════════════════

describe("api.stream — model allow-list & budget", () => {
  it("ignores a non-client-selectable model (Opus) and uses the tool default", async () => {
    await invoke(
      { slug: "socratic-partner", values: { chapter: "x" }, model: "claude-opus-4-8" },
      { userId: "allow-opus" },
    );
    expect(streamChatSpy.mock.calls[0][0].model).toBe("claude-sonnet-4-6");
  });

  it("honours a client-selectable model (Haiku)", async () => {
    await invoke(
      { slug: "socratic-partner", values: { chapter: "x" }, model: "claude-haiku-4-5" },
      { userId: "allow-haiku" },
    );
    expect(streamChatSpy.mock.calls[0][0].model).toBe("claude-haiku-4-5");
  });

  it("falls back to the tool default when the requested model is not admin-enabled", async () => {
    await settings.setEnabledModels(["claude-sonnet-4-6"]);
    await invoke(
      { slug: "socratic-partner", values: { chapter: "x" }, model: "claude-haiku-4-5" },
      { userId: "avail-model" },
    );
    expect(streamChatSpy.mock.calls[0][0].model).toBe("claude-sonnet-4-6");
    await settings.setEnabledModels(null); // reset
  });

  it("[P13] a per-teacher assignment blocks a model outside it (falls back to default)", async () => {
    await settings.setEnabledModels(null); // instance base = full catalog
    const teacherId = "p13-assigned-teacher";
    await users.setUserAssignedModels(teacherId, ["claude-sonnet-4-6"]); // haiku not assigned
    await invoke(
      { slug: "socratic-partner", values: { chapter: "x" }, model: "claude-haiku-4-5" },
      { userId: teacherId }, // default role teacher
    );
    // haiku ∉ the teacher's set → refused → tool default (sonnet), not the forced haiku.
    expect(streamChatSpy.mock.calls[0][0].model).toBe("claude-sonnet-4-6");
    await users.setUserAssignedModels(teacherId, null); // reset
  });

  it("[P13] a cohort's model set blocks a model outside it for its students", async () => {
    await settings.setEnabledModels(null);
    const student = "p13-cohort-student";
    const cohort = await cohorts.createCohort({
      createdByUserId: "p13-teacher",
      name: "Sonnet-only cohort",
      allowedToolSlugs: ["socratic-partner"],
      allowedModelIds: ["claude-sonnet-4-6"], // haiku excluded
    });
    await cohorts.addMembership(cohort.id, student);
    asUser(student, "student");
    await invoke({
      slug: "socratic-partner",
      values: { chapter: "x" },
      model: "claude-haiku-4-5",
    });
    expect(streamChatSpy.mock.calls[0][0].model).toBe("claude-sonnet-4-6");
  });

  it("[P14] an uncurated instance still honours a local/CLI model (back-compat)", async () => {
    await settings.setEnabledModels(null); // nothing curated → local stays available
    await invoke(
      { slug: "socratic-partner", values: { chapter: "x" }, model: "claude-code" },
      { userId: "p14-uncurated-teacher" },
    );
    expect(streamChatSpy.mock.calls[0][0].model).toBe("claude-code");
  });

  it("[P14] a CLI model disabled instance-wide falls back to the tool default", async () => {
    await settings.setEnabledModels(["claude-sonnet-4-6"]); // claude-code NOT enabled
    await invoke(
      { slug: "socratic-partner", values: { chapter: "x" }, model: "claude-code" },
      { userId: "p14-curated-teacher" },
    );
    expect(streamChatSpy.mock.calls[0][0].model).toBe("claude-sonnet-4-6");
    await settings.setEnabledModels(null); // reset
  });

  it("[P14] a local/CLI model outside a cohort's set is refused for its students", async () => {
    await settings.setEnabledModels(null);
    const student = "p14-cohort-student";
    const cohort = await cohorts.createCohort({
      createdByUserId: "p14-teacher-2",
      name: "Sonnet-only — local now governed",
      allowedToolSlugs: ["socratic-partner"],
      allowedModelIds: ["claude-sonnet-4-6"], // claude-code excluded
    });
    await cohorts.addMembership(cohort.id, student);
    asUser(student, "student");
    await invoke({
      slug: "socratic-partner",
      values: { chapter: "x" },
      model: "claude-code", // no longer free-passed → falls back to default
    });
    expect(streamChatSpy.mock.calls[0][0].model).toBe("claude-sonnet-4-6");
  });

  it("streams with the tool's configured maxTokens budget", async () => {
    await invoke({ slug: "socratic-partner", values: { chapter: "x" } }, { userId: "budget" });
    expect(streamChatSpy.mock.calls[0][0].maxTokens).toBe(2048); // chat tutor budget
  });

  it("[bugfix] a cohort allowing ONLY a local model serves it, never the disabled tool default", async () => {
    await settings.setEnabledModels(null); // uncurated instance → local model is free
    const student = "local-only-cohort-student";
    const cohort = await cohorts.createCohort({
      createdByUserId: "local-only-cohort-teacher",
      name: "Ollama-only cohort",
      allowedToolSlugs: ["socratic-partner"],
      allowedModelIds: ["ollama::qwen3.6:27b-coding-nvfp4"], // Sonnet NOT allowed
    });
    await cohorts.addMembership(cohort.id, student);
    asUser(student, "student");

    // The student explicitly picks the cohort's only model → used verbatim.
    await invoke({
      slug: "socratic-partner",
      values: { chapter: "x" },
      model: "ollama::qwen3.6:27b-coding-nvfp4",
    });
    expect(streamChatSpy.mock.calls[0][0].model).toBe("ollama::qwen3.6:27b-coding-nvfp4");

    // The reported bug: a stale client sends the (disabled) tool default. The
    // server must NOT serve it — it substitutes the cohort's only allowed model.
    streamChatSpy.mockClear();
    await invoke({
      slug: "socratic-partner",
      values: { chapter: "x" },
      model: "claude-sonnet-4-6", // disabled for this cohort
    });
    expect(streamChatSpy.mock.calls[0][0].model).toBe("ollama::qwen3.6:27b-coding-nvfp4");
    expect(streamChatSpy.mock.calls[0][0].model).not.toBe("claude-sonnet-4-6");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Cohort chat happy-path (P6) — membership-authorized profile + config injection
// ════════════════════════════════════════════════════════════════════════════

describe("api.stream — provisioned student (P6)", () => {
  it("injects the cohort's config values and membership-authorized profile into the prompt", async () => {
    const student = "cohort-happy-student";
    const profile = await profiles.createProfile("cohort-teacher", {
      name: "Cohort profile",
      eqf: 6,
    });
    const cohort = await cohorts.createCohort({
      createdByUserId: "cohort-teacher",
      name: "SE cohort",
      allowedToolSlugs: ["socratic-partner"],
      config: { "socratic-partner": { values: { chapter: "Photosynthesis" } } },
      contextProfileId: profile.id,
      activeUntil: null,
    });
    await cohorts.addMembership(cohort.id, student);
    asUser(student, "student");

    await invoke({
      slug: "socratic-partner",
      // A tampered client value must lose to the cohort's server-authoritative config.
      values: { chapter: "CLIENT-TAMPERED" },
      messages: [{ role: "user", content: "hoi" }],
    });

    expect(streamChatSpy).toHaveBeenCalledTimes(1);
    const { system } = streamChatSpy.mock.calls[0][0];
    expect(system).toContain("Photosynthesis"); // cohort config won
    expect(system).not.toContain("CLIENT-TAMPERED");
    expect(system).toContain("EQF 6"); // profile injected by membership
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SSE mechanics
// ════════════════════════════════════════════════════════════════════════════

describe("api.stream — SSE mechanics", () => {
  it("emits token frames in order followed by a done frame", async () => {
    streamChatSpy.mockImplementation(async function* () {
      yield "Hel";
      yield "lo";
    });
    const res = await invoke(
      { slug: "authentic-assessment", values: fullValues("authentic-assessment") },
      { userId: "sse-order" },
    );
    const text = await res.text();
    expect(sseTokens(text)).toEqual(["Hel", "lo"]);
    expect(text).toContain("event: done");
  });

  it("a mid-stream provider throw produces a trailing localized error frame (via sseStream)", async () => {
    async function* failing() {
      yield "partial";
      throw new Error("kaboom");
    }
    const stream = sseStream(failing(), { formatError: () => "LOCALIZED-ERROR" });
    const text = await new Response(stream).text();
    expect(sseTokens(text)).toEqual(["partial"]);
    expect(sseErrorMessage(text)).toBe("LOCALIZED-ERROR");
    expect(text).not.toContain("event: done"); // a failed stream never "completes"
  });
});
