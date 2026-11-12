import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { C1, C2, EV, LU, sampleDossier } from "../portfolio/fixtures";
import type { DossierData } from "~/lib/portfolio/types";

process.env.DATABASE_URL = "file::memory:";

const { generate, currentUser, quota } = vi.hoisted(() => ({
  generate: vi.fn(),
  currentUser: { value: { id: "teacher-b", name: "B", email: null, role: "teacher" } as never },
  quota: { ok: true },
}));
vi.mock("~/lib/ai/provider", () => ({ providerForModel: () => ({ id: "fake", generate }) }));
vi.mock("~/server/auth.server", () => ({
  requireUser: vi.fn(async () => currentUser.value),
  requireRole: vi.fn(async () => currentUser.value),
}));
vi.mock("~/server/repositories/usage.server", () => ({
  checkQuota: vi.fn(async () => ({ ok: quota.ok })),
  recordUsage: vi.fn(async () => {}),
}));
vi.mock("~/server/availability.server", () => ({
  effectiveDefaultModel: vi.fn(async () => "claude-sonnet-5-5"),
  getAvailableTools: vi.fn(async () => []),
  effectiveFeatures: vi.fn(async () => ({ portfolio: { on: true, source: "default" } })),
}));

let repo: typeof import("~/server/repositories/portfolio.server");
let route: typeof import("~/routes/portfolio.$id.evidence");

beforeAll(async () => {
  repo = await import("~/server/repositories/portfolio.server");
  route = await import("~/routes/portfolio.$id.evidence");
});

beforeEach(() => {
  generate.mockReset();
  quota.ok = true;
});

const confirmed = (): DossierData => {
  const d = sampleDossier();
  return { ...d, framework: { ...d.framework, confirmedAt: 1 } };
};

function post(fields: [string, string][]) {
  return new Request("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}
const act = (id: string, fields: [string, string][]) =>
  route.action({ request: post(fields), params: { id } } as never);

const files = [
  { key: "f1", name: "LU1/lesplan.docx", text: "Lesplan medicijnrekenen voor 2B." },
  { key: "f2", name: "LU1/feedback.pdf", text: "Feedback van mijn werkplekbegeleider." },
];

describe("evidence in one go — the page", () => {
  it("loads the framework the list needs and the room left in the dossier", async () => {
    const mine = await repo.createDossier("teacher-b", "B", confirmed());
    const page = await route.loader({
      request: new Request("http://localhost/x"),
      params: { id: mine.id },
    } as never);
    expect(page.confirmed).toBe(true);
    expect(page.room).toBe(99);
    expect(page.outcomes[0]).toMatchObject({
      id: LU,
      code: "LU1",
      criteria: [{ id: C1 }, { id: C2 }],
      requiredEvidence: ["Feedback van de werkplekbegeleider", "Opname van de les"],
    });
  });

  it("is a 404 for someone else's dossier", async () => {
    const theirs = await repo.createDossier("someone-else", "X", confirmed());
    await expect(
      route.loader({
        request: new Request("http://localhost/x"),
        params: { id: theirs.id },
      } as never),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("evidence in one go — proposals", () => {
  it("asks the model once per file and returns checked proposals, storing nothing", async () => {
    const mine = await repo.createDossier("teacher-b", "B", confirmed());
    generate.mockImplementation(async ({ messages }) => ({
      text: messages[0].content.includes("lesplan.docx")
        ? JSON.stringify({
            outcome: "U1",
            kind: "lesson-plan",
            criteria: ["U1.C1"],
            required: null,
            title: "Lesplan",
            sure: true,
          })
        : JSON.stringify({
            outcome: "U1",
            kind: "feedback",
            criteria: ["U1.C2"],
            required: "U1.R1",
            title: "Feedback",
            sure: false,
          }),
    }));
    const r = await act(mine.id, [
      ["intent", "proposeEvidence"],
      ["files", JSON.stringify(files)],
    ]);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[0]![0].system).toContain("Voice & Bounds");
    if (!r.ok || !("sorted" in r)) throw new Error(JSON.stringify(r));
    expect(r.intent).toBe("proposeEvidence");
    expect(r.sorted).toEqual([
      expect.objectContaining({ key: "f1", outcomeId: LU, criterionIds: [C1], check: false }),
      expect.objectContaining({
        key: "f2",
        line: "Feedback van de werkplekbegeleider",
        check: true,
      }),
    ]);
    const after = await repo.getDossier("teacher-b", mine.id);
    expect(after?.data.evidence.map((e) => e.id)).toEqual([EV]);
  });

  it("a failed call still gives the file a row to check by hand", async () => {
    const mine = await repo.createDossier("teacher-b", "B", confirmed());
    generate.mockRejectedValue(new Error("down"));
    const r = await act(mine.id, [
      ["intent", "proposeEvidence"],
      ["files", JSON.stringify(files.slice(0, 1))],
    ]);
    if (!r.ok || !("sorted" in r)) throw new Error(JSON.stringify(r));
    expect(r.sorted).toEqual([
      { key: "f1", title: "lesplan", kind: "other", criterionIds: [], check: true },
    ]);
  });

  it("needs a confirmed framework and respects the quota, without calling the model", async () => {
    const open = await repo.createDossier("teacher-b", "B", sampleDossier());
    const notConfirmed = await act(open.id, [
      ["intent", "proposeEvidence"],
      ["files", JSON.stringify(files)],
    ]);
    expect(notConfirmed.ok).toBe(false);
    quota.ok = false;
    const mine = await repo.createDossier("teacher-b", "B", confirmed());
    const over = await act(mine.id, [
      ["intent", "proposeEvidence"],
      ["files", JSON.stringify(files)],
    ]);
    expect(over.ok).toBe(false);
    expect(generate).not.toHaveBeenCalled();
  });

  it("refuses a malformed list of files", async () => {
    const mine = await repo.createDossier("teacher-b", "B", confirmed());
    const r = await act(mine.id, [
      ["intent", "proposeEvidence"],
      ["files", "[{]"],
    ]);
    expect(r.ok).toBe(false);
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("evidence in one go — adding what was ticked", () => {
  it("adds the ticked items with their links in one save", async () => {
    const mine = await repo.createDossier("teacher-b", "B", confirmed());
    const items = [
      {
        title: "Feedback",
        kind: "feedback",
        text: "Goed gedaan.",
        outcomeId: LU,
        criterionIds: [C2],
        line: "Feedback van de werkplekbegeleider",
      },
      { title: "Lesplan", kind: "lesson-plan", text: "Les.", outcomeId: LU, criterionIds: [C1] },
    ];
    const r = await act(mine.id, [
      ["intent", "addEvidenceBatch"],
      ["items", JSON.stringify(items)],
    ]);
    expect(r).toEqual({ ok: true, intent: "addEvidenceBatch", added: 2 });
    const after = await repo.getDossier("teacher-b", mine.id);
    expect(after?.data.evidence.map((e) => e.title)).toEqual([
      "Feedback werkplekbegeleider",
      "Feedback",
      "Lesplan",
    ]);
    expect(after?.data.evidence[1]?.requirements).toEqual([
      { outcomeId: LU, line: "Feedback van de werkplekbegeleider" },
    ]);
  });

  it("stores nothing when one item is wrong", async () => {
    const mine = await repo.createDossier("teacher-b", "B", confirmed());
    const items = [
      { title: "Goed", kind: "other", text: "", outcomeId: LU, criterionIds: [C1] },
      { title: "Fout", kind: "other", text: "", outcomeId: LU, criterionIds: ["nope"] },
    ];
    const r = await act(mine.id, [
      ["intent", "addEvidenceBatch"],
      ["items", JSON.stringify(items)],
    ]);
    expect(r.ok).toBe(false);
    const after = await repo.getDossier("teacher-b", mine.id);
    expect(after?.data.evidence).toHaveLength(1);
  });
});
