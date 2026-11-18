import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { flatRoutes } from "../helpers/routes";
import { C1, C2, EV, sampleDossier } from "../portfolio/fixtures";
import type { DossierData } from "~/lib/portfolio/types";

process.env.DATABASE_URL = "file::memory:";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("~/lib/ai/provider", () => ({ providerForModel: () => ({ id: "fake", generate }) }));

let repo: typeof import("~/server/repositories/portfolio.server");
let route: typeof import("~/routes/portfolio.$id.quotes");

beforeAll(async () => {
  repo = await import("~/server/repositories/portfolio.server");
  route = await import("~/routes/portfolio.$id.quotes");
});

beforeEach(async () => {
  generate.mockReset();
  await signInAs({ id: "teacher-q", name: "Q" });
});

const FEEDBACK =
  "5. Je uitleg over de dosering was helder: je tekende het op het bord en vroeg twee studenten het na te doen.\n6. Goed gedaan!";

/** A confirmed dossier with one feedback item, and one lesson plan. */
function dossier(): DossierData {
  const d = sampleDossier();
  return {
    ...d,
    framework: { ...d.framework, confirmedAt: 1 },
    evidence: [
      { ...d.evidence[0]!, text: FEEDBACK },
      { id: "lesplan", title: "Lesplan", kind: "lesson-plan", text: "Plan.", criterionIds: [] },
    ],
  };
}

function post(fields: [string, string][]) {
  return signedRequest("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: new URLSearchParams(fields).toString(),
  });
}
const act = async (id: string, fields: [string, string][]) =>
  (await route.action({ request: post(fields), params: { id } } as never)) as Record<
    string,
    unknown
  >;
const load = (id: string) =>
  route.loader({
    request: signedRequest("http://localhost/x", { headers: { Cookie: "lang=nl" } }),
    params: { id },
  } as never);

const approved = JSON.stringify({ approved: [], keep: [] });

describe("quotes from feedback — the page", () => {
  it("is a route of the workplace", () => {
    expect(flatRoutes().map((r) => r.file)).toContain("routes/portfolio.$id.quotes.tsx");
  });

  it("lists only the feedback items, with the criteria and what the gate needs", async () => {
    const mine = await repo.createDossier("teacher-q", "Q", dossier());
    const page = await load(mine.id);
    expect(page.items.map((i) => i.id)).toEqual([EV]);
    expect(page.items[0]).toMatchObject({ title: "Feedback werkplekbegeleider", text: FEEDBACK });
    expect(page.outcomes[0]?.criteria.map((c) => c.id)).toEqual([C1, C2]);
    expect(page.privacy).toMatchObject({ never: [], shared: [] });
  });

  it("is a 404 for someone else's dossier", async () => {
    const theirs = await repo.createDossier("someone-else", "X", dossier());
    await expect(load(theirs.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("Stel citaten voor", () => {
  it("proposes only the sentences that stand in the feedback, and stores nothing", async () => {
    const mine = await repo.createDossier("teacher-q", "Q", dossier());
    generate.mockResolvedValue({
      text: JSON.stringify({
        quotes: [
          {
            criterion: "U1.C2",
            quote: "je tekende het op het bord en vroeg twee studenten het na te doen",
          },
          { criterion: "U1.C1", quote: "Je les was perfect opgebouwd." },
        ],
      }),
    });
    const r = await act(mine.id, [
      ["intent", "proposeQuotes"],
      ["evidenceId", EV],
      ["role", "workplace-supervisor"],
      ["privacy", approved],
    ]);
    expect(r).toMatchObject({
      ok: true,
      intent: "proposeQuotes",
      evidenceId: EV,
      quotes: [
        {
          criterionId: C2,
          text: "je tekende het op het bord en vroeg twee studenten het na te doen",
        },
      ],
      dropped: 1,
    });
    const sent = generate.mock.calls[0]![0];
    expect(sent.messages[0].content).toContain('<feedback role="Werkplekbegeleider">');
    expect(
      (await repo.getDossier("teacher-q", mine.id))?.data.evidence[0]?.feedback,
    ).toBeUndefined();
  });

  it("asks the teacher first when the gate finds a word they did not see", async () => {
    const d = dossier();
    d.evidence[0]!.text = `${FEEDBACK}\nVragen? Mail m.degroot@school.nl`;
    const mine = await repo.createDossier("teacher-q", "Q", d);
    const r = await act(mine.id, [
      ["intent", "proposeQuotes"],
      ["evidenceId", EV],
      ["role", "workplace-supervisor"],
    ]);
    expect(generate).not.toHaveBeenCalled();
    expect(r).toMatchObject({
      ok: false,
      intent: "proposeQuotes",
      privacyReview: [{ kind: "email" }],
    });
  });

  it("says so when the answer could not be read", async () => {
    const mine = await repo.createDossier("teacher-q", "Q", dossier());
    generate.mockResolvedValue({ text: "Sorry." });
    const r = await act(mine.id, [
      ["intent", "proposeQuotes"],
      ["evidenceId", EV],
      ["role", "expert"],
      ["privacy", approved],
    ]);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/opnieuw/i) });
  });

  it("refuses an item that is no feedback", async () => {
    const mine = await repo.createDossier("teacher-q", "Q", dossier());
    const r = await act(mine.id, [
      ["intent", "proposeQuotes"],
      ["evidenceId", "lesplan"],
      ["role", "expert"],
      ["privacy", approved],
    ]);
    expect(r).toMatchObject({ ok: false });
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("Bewaar citaten", () => {
  it("stores the giver, role, date and the chosen quotes, and links the criteria", async () => {
    const mine = await repo.createDossier("teacher-q", "Q", dossier());
    const r = await act(mine.id, [
      ["intent", "chooseQuotes"],
      ["evidenceId", EV],
      ["giver", "M. de Groot"],
      ["role", "workplace-supervisor"],
      ["date", "2026-11-12"],
      ["quotes", JSON.stringify([{ criterionId: C2, text: "je tekende het op het bord" }])],
    ]);
    expect(r).toMatchObject({ ok: true, intent: "chooseQuotes", saved: 1 });
    const e = (await repo.getDossier("teacher-q", mine.id))?.data.evidence[0];
    expect(e?.feedback).toEqual({
      giver: "M. de Groot",
      role: "workplace-supervisor",
      date: "2026-11-12",
      quotes: [{ criterionId: C2, text: "je tekende het op het bord" }],
    });
    expect(e?.criterionIds).toEqual([C1, C2]);
  });

  it("refuses an item that is no feedback", async () => {
    const mine = await repo.createDossier("teacher-q", "Q", dossier());
    const r = await act(mine.id, [
      ["intent", "chooseQuotes"],
      ["evidenceId", "lesplan"],
      ["giver", "M. de Groot"],
      ["role", "expert"],
      ["date", ""],
      ["quotes", "[]"],
    ]);
    expect(r).toMatchObject({ ok: false });
    expect(
      (await repo.getDossier("teacher-q", mine.id))?.data.evidence[1]?.feedback,
    ).toBeUndefined();
  });

  it("refuses a quote that is not in the feedback, and stores nothing", async () => {
    const mine = await repo.createDossier("teacher-q", "Q", dossier());
    const r = await act(mine.id, [
      ["intent", "chooseQuotes"],
      ["evidenceId", EV],
      ["giver", "M. de Groot"],
      ["role", "workplace-supervisor"],
      ["date", ""],
      ["quotes", JSON.stringify([{ criterionId: C2, text: "Je bent de beste docent ooit." }])],
    ]);
    expect(r).toMatchObject({ ok: false });
    expect(
      (await repo.getDossier("teacher-q", mine.id))?.data.evidence[0]?.feedback,
    ).toBeUndefined();
  });
});
