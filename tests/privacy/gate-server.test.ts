import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "file::memory:";

// The outside world: the model and Jev. Everything else is real (users, teams, the engine).
const { generate, streamChat, postDecisions } = vi.hoisted(() => ({
  generate: vi.fn(),
  streamChat: vi.fn(),
  postDecisions: vi.fn(),
}));
vi.mock("~/lib/ai/provider", () => ({
  providerForModel: () => ({ id: "fake", generate, streamChat }),
}));
vi.mock("~/lib/ai/decisions", () => ({ postDecisions }));

let gate: typeof import("~/server/privacyGate.server");

beforeAll(async () => {
  gate = await import("~/server/privacyGate.server");
  const users = await import("~/server/repositories/users.server");
  const teams = await import("~/server/repositories/teams.server");
  await users.createUser({ id: "pg-a", name: "Mark de Groot", passwordHash: "x", role: "teacher" });
  await users.createUser({
    id: "pg-b",
    name: "Fatima el Amrani",
    passwordHash: "x",
    role: "teacher",
  });
  const team = await teams.createTeam("Team PG");
  await teams.addMember(team.id, "pg-a");
  await teams.addMember(team.id, "pg-b");
});

afterEach(() => vi.clearAllMocks());

const user = { id: "pg-a" };
const prompt = {
  model: "claude-sonnet-5-5",
  system: "Je bent een coach.",
  messages: [{ role: "user" as const, content: "Vraag Fatima el Amrani, mail fatima@school.nl." }],
};
async function* tokens(...parts: string[]) {
  for (const p of parts) yield p;
}
async function collect(it: AsyncIterable<string>) {
  let out = "";
  for await (const c of it) out += c;
  return out;
}
/** The gate's log lines, parsed. */
function gateLogs(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls
    .map((c) => JSON.parse(String(c[0])) as Record<string, unknown>)
    .filter((l: Record<string, unknown>) => l.event === "privacy-gate");
}

describe("until the teacher sees a preview: only counting (BESLUIT-2026-11-17-5)", () => {
  it("sends the prompt unchanged and logs how much it would replace, never what", async () => {
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    generate.mockResolvedValue({ text: "Goed idee." });
    const r = await gate.gatedGenerate(user, prompt, { exit: "portfolio", locale: "nl" });
    expect(r).toEqual({ ok: true, value: { text: "Goed idee." } });
    expect(generate.mock.calls[0]?.[0]).toMatchObject({
      system: prompt.system,
      messages: prompt.messages,
    });
    const [line] = gateLogs(logs);
    expect(line).toMatchObject({
      exit: "portfolio",
      mode: "count",
      outcome: "sent",
      counts: { colleague: 1, email: 1 },
    });
    expect(JSON.stringify(logs.mock.calls)).not.toMatch(/Fatima|fatima@/);
    logs.mockRestore();
  });
});

describe("with what the teacher saw", () => {
  const approval = { approved: ["Fatima el Amrani", "fatima@school.nl"], keep: [] };

  it("replaces, adds the sentence about codes, and puts the names back in the answer", async () => {
    generate.mockResolvedValue({ text: "Overleg met [COLLEGA-1] via [E-MAIL-1]." });
    const r = await gate.gatedGenerate(user, prompt, { exit: "portfolio", locale: "nl", approval });
    const sent = generate.mock.calls[0]?.[0];
    expect(sent.messages[0].content).toBe("Vraag [COLLEGA-1], mail [E-MAIL-1].");
    expect(sent.system).toMatch(/blokhaken/);
    expect(r).toEqual({
      ok: true,
      value: { text: "Overleg met Fatima el Amrani via fatima@school.nl." },
    });
  });

  it("streams the answer with the names back, even over a chunk border", async () => {
    streamChat.mockReturnValue(tokens("Overleg met [COLL", "EGA-1]."));
    const r = await gate.gatedStream(user, prompt, { exit: "stream", locale: "nl", approval });
    expect(r.ok && (await collect(r.value))).toBe("Overleg met Fatima el Amrani.");
  });

  it("sends nothing when something was not seen, and lays it before the teacher", async () => {
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await gate.gatedStream(user, prompt, {
      exit: "stream",
      locale: "nl",
      approval: { approved: ["fatima@school.nl"], keep: [] },
    });
    expect(r).toEqual({
      ok: false,
      review: [{ value: "Fatima el Amrani", code: "COLLEGA-1", kind: "colleague", count: 1 }],
    });
    expect(streamChat).not.toHaveBeenCalled();
    expect(gateLogs(logs)[0]).toMatchObject({ mode: "review", outcome: "review" });
    logs.mockRestore();
  });

  it("gates Jev's state and restores the strings of its answer", async () => {
    postDecisions.mockResolvedValue({ reason: "Past bij [COLLEGA-1]", p: 0.9 });
    const r = await gate.gatedDecisions(
      user,
      "https://jev.example/decisions",
      { model: "jev", state: { file: "Fatima el Amrani - verslag.pdf" }, questions: { q: "?" } },
      { apiKey: "k" },
      { exit: "jev", locale: "nl", approval: { approved: ["Fatima el Amrani"], keep: [] } },
    );
    expect(postDecisions.mock.calls[0]?.[1].state).toEqual({ file: "[COLLEGA-1] - verslag.pdf" });
    expect(r).toEqual({ ok: true, value: { reason: "Past bij Fatima el Amrani", p: 0.9 } });
  });
});
