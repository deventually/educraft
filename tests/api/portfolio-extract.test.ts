import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleDossier } from "../portfolio/fixtures";
import { emptyDossier } from "~/lib/portfolio/schema";

process.env.DATABASE_URL = "file::memory:";

const { generate, currentUser, quota, recordUsage } = vi.hoisted(() => ({
  generate: vi.fn(),
  currentUser: { value: { id: "teacher-e", name: "E", email: null, role: "teacher" } as never },
  quota: { ok: true },
  recordUsage: vi.fn(async () => {}),
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
  effectiveFeatures: vi.fn(async () => ({ portfolio: { on: true, source: "default" } })),
}));

let extract: typeof import("~/server/portfolioExtract.server");
let repo: typeof import("~/server/repositories/portfolio.server");
let frameworkRoute: typeof import("~/routes/portfolio.$id.framework");

beforeAll(async () => {
  extract = await import("~/server/portfolioExtract.server");
  repo = await import("~/server/repositories/portfolio.server");
  frameworkRoute = await import("~/routes/portfolio.$id.framework");
});

beforeEach(() => {
  generate.mockReset();
  recordUsage.mockClear();
  quota.ok = true;
});

const user = { id: "teacher-e", name: "E", email: null, role: "teacher" } as never;

const FORM =
  "Leeruitkomst 1 Doceren\n1. De docent geeft een heldere les.\n2. De docent stelt vragen.";
const answer = (criteria: string[]) =>
  JSON.stringify({
    institution: null,
    outcomes: [{ code: "LU1", title: "Doceren", criteria: criteria.map((text) => ({ text })) }],
    requirements: {},
  });

describe("extractFramework", () => {
  it("proposes an unconfirmed framework, flags invented criteria, counts usage", async () => {
    generate.mockResolvedValueOnce({
      text: answer(["De docent geeft een heldere les.", "De docent werkt samen met collega's."]),
      usage: { output: 50 },
    });
    const r = await extract.extractFramework(user, emptyDossier(["bdb"]), FORM, "nl");
    if (!r.ok) throw new Error(r.error);
    expect(r.flagged).toBe(1);
    expect(r.data.framework.confirmedAt).toBeUndefined();
    expect(r.data.framework.outcomes[0]!.criteria.map((c) => !!c.unverified)).toEqual([
      false,
      true,
    ]);
    expect(recordUsage).toHaveBeenCalledOnce();
    const call = generate.mock.calls[0]![0];
    expect(call.model).toBe("claude-sonnet-5-5");
    expect(call.system).toContain("Voice & Bounds");
    expect(call.messages[0].content).toContain("<form>");
    expect(call.temperature).toBe(0);
  });

  it("retries once on broken JSON, then gives a failure", async () => {
    generate
      .mockResolvedValueOnce({ text: "{ kapot" })
      .mockResolvedValueOnce({ text: answer(["De docent stelt vragen."]) });
    expect((await extract.extractFramework(user, emptyDossier(["bdb"]), FORM, "nl")).ok).toBe(true);
    generate.mockReset();
    generate.mockResolvedValue({ text: "{ kapot" });
    expect(await extract.extractFramework(user, emptyDossier(["bdb"]), FORM, "nl")).toEqual({
      ok: false,
      error: "failed",
    });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("refuses an empty form, a framework in use and an exhausted quota without a call", async () => {
    expect(await extract.extractFramework(user, emptyDossier(["bdb"]), "  ", "nl")).toEqual({
      ok: false,
      error: "empty-form",
    });
    expect(await extract.extractFramework(user, sampleDossier(), FORM, "nl")).toEqual({
      ok: false,
      error: "in-use",
    });
    quota.ok = false;
    expect(await extract.extractFramework(user, emptyDossier(["bdb"]), FORM, "nl")).toEqual({
      ok: false,
      error: "quota",
    });
    expect(generate).not.toHaveBeenCalled();
  });
});

function post(fields: Record<string, string>): Request {
  return new Request("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: new URLSearchParams(fields).toString(),
  });
}

describe("the framework page, intent extract", () => {
  it("stores the proposal and reports how many criteria to check", async () => {
    const mine = await repo.createDossier("teacher-e", "Mijn BDB", emptyDossier(["bdb"]));
    generate.mockResolvedValueOnce({
      text: answer(["De docent geeft een heldere les.", "Verzonnen criterium."]),
    });
    const r = await frameworkRoute.action({
      request: post({ intent: "extract", formText: FORM }),
      params: { id: mine.id },
    } as never);
    expect(r).toEqual({ ok: true, intent: "extract", flagged: 1, clipped: false });
    const saved = await repo.getDossier("teacher-e", mine.id);
    expect(saved?.data.framework.outcomes[0]?.criteria).toHaveLength(2);
  });

  it("gives a localized error and saves nothing when the framework is in use", async () => {
    const mine = await repo.createDossier("teacher-e", "Lopend", sampleDossier());
    const r = await frameworkRoute.action({
      request: post({ intent: "extract", formText: FORM }),
      params: { id: mine.id },
    } as never);
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toMatch(/al in gebruik/);
    expect(generate).not.toHaveBeenCalled();
    expect((await repo.getDossier("teacher-e", mine.id))?.data).toEqual(sampleDossier());
  });
});
