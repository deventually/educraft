import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
// The seam: the provider. Auth, the database and the checks are real.
vi.mock("~/lib/ai/provider", () => ({ providerForModel: () => ({ id: "fake", generate }) }));

let detail: typeof import("~/routes/tracks.$id");
let repo: typeof import("~/server/repositories/tracks.server");

const A = "ff-a";

beforeAll(async () => {
  detail = await import("~/routes/tracks.$id");
  repo = await import("~/server/repositories/tracks.server");
});

beforeEach(async () => {
  generate.mockReset();
  await signInAs({ id: A });
});

function post(id: string, fields: Record<string, string>) {
  return detail.action({
    request: signedRequest(`http://localhost/tracks/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
      body: new URLSearchParams(fields).toString(),
    }),
    params: { id },
  } as never) as Promise<{ ok: boolean; intent?: string; error?: string }>;
}

const V1 = "Mijn onderzoeksvraag gaat over de servicedesk van [BEDRIJF-1].";
const V2 = "Hoe kan [BEDRIJF-1] de wachttijd met 20% verlagen? Ik interview vijf medewerkers.";
const CRITERIA = "C1 Onderzoeksvraag\nC2 Methode";
const reply = (o: unknown) => ({ text: JSON.stringify(o), usage: undefined });

async function track() {
  const t = await repo.createTrack(A, { code: "S-FF", kind: "thesis" });
  if (!t) throw new Error("no track");
  return t;
}

describe("feedforward on a draft (P38.3)", () => {
  it("round 1: feedback per criterion, no grade, kept as a drafts round with numbered points", async () => {
    const t = await track();
    generate.mockResolvedValueOnce(
      reply({
        criteria: [
          {
            criterion: "C1 Onderzoeksvraag",
            strengths: ["Het onderwerp is concreet."],
            improvements: ["Maak de vraag meetbaar.", "Dit is een 5/10."],
          },
        ],
        followUp: [],
      }),
    );
    const r = await post(t.id, { intent: "feedforward", version: V1, criteria: CRITERIA });
    expect(r).toMatchObject({ ok: true, intent: "feedforward" });
    const sent = generate.mock.calls[0]?.[0] as { messages: { content: string }[]; system: string };
    expect(sent.messages[0]?.content).toContain(`<criteria>\n${CRITERIA}\n</criteria>`);
    expect(sent.messages[0]?.content).not.toContain("<previous>");
    const [round] = await repo.listRounds(A, t.id);
    expect(round).toMatchObject({ milestone: "drafts", round: 1, redactedText: V1 });
    expect(round?.feedback.points).toEqual([
      { id: "p1", criterion: "C1 Onderzoeksvraag", text: "Maak de vraag meetbaar." },
    ]);
    expect(round?.feedback.text).toContain("### C1 Onderzoeksvraag");
    expect(round?.feedback.text).not.toContain("5/10");
  });

  it("round 2 gets the earlier points; a made-up improvement shows as not visible", async () => {
    const t = await track();
    await repo.addRound(A, t.id, {
      milestone: "drafts",
      redactedText: V1,
      feedback: {
        text: "…",
        points: [
          { id: "p1", criterion: "C1", text: "Maak de vraag meetbaar." },
          { id: "p2", criterion: "C2", text: "Noem drie bronnen." },
        ],
      },
    });
    generate.mockResolvedValueOnce(
      reply({
        criteria: [{ criterion: "C1", strengths: [], improvements: ["Leg de 20% uit."] }],
        followUp: [
          { point: "p1", status: "addressed", quote: "de wachttijd met 20% verlagen" },
          { point: "p2", status: "addressed", quote: "Ik gebruik drie bronnen." },
        ],
      }),
    );
    const r = await post(t.id, { intent: "feedforward", version: V2, criteria: CRITERIA });
    expect(r.ok).toBe(true);
    const sent = generate.mock.calls[0]?.[0] as { messages: { content: string }[] };
    expect(sent.messages[0]?.content).toContain("[p1] C1: Maak de vraag meetbaar.");
    const rounds = await repo.listRounds(A, t.id);
    const last = rounds.at(-1);
    expect(last?.round).toBe(2);
    expect(last?.feedback.text).toContain(
      '**Opgepakt:** Maak de vraag meetbaar. *"de wachttijd met 20% verlagen"*',
    );
    expect(last?.feedback.text).toContain("**Niet te zien:** Noem drie bronnen.");
  });

  it("an unreadable answer gets one retry; twice unreadable keeps nothing", async () => {
    const t = await track();
    generate.mockResolvedValue({ text: "Sorry, geen JSON.", usage: undefined });
    const r = await post(t.id, { intent: "feedforward", version: V1, criteria: CRITERIA });
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(await repo.listRounds(A, t.id)).toEqual([]);
  });

  it("refuses an empty draft and a closed track without calling the model", async () => {
    const t = await track();
    expect((await post(t.id, { intent: "feedforward", version: " ", criteria: CRITERIA })).ok).toBe(
      false,
    );
    await repo.closeTrack(A, t.id);
    expect((await post(t.id, { intent: "feedforward", version: V1, criteria: CRITERIA })).ok).toBe(
      false,
    );
    expect(generate).not.toHaveBeenCalled();
  });
});
