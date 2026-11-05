import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { flatRoutes } from "../helpers/routes";
import { C1, LU, sampleDossier } from "../portfolio/fixtures";

// P29.3: the rehearsal page of a dossier, and "Bewaar in je dossier".
process.env.DATABASE_URL = "file::memory:";

const { currentUser } = vi.hoisted(() => ({
  currentUser: { value: { id: "teacher-a", name: "A", email: null, role: "teacher" } as never },
}));
vi.mock("~/server/auth.server", () => ({
  requireUser: vi.fn(async () => currentUser.value),
  requireRole: vi.fn(async () => currentUser.value),
}));

let repo: typeof import("~/server/repositories/portfolio.server");
let route: typeof import("~/routes/portfolio.$id.rehearsal");
let ownId = "";
let foreignId = "";

beforeAll(async () => {
  repo = await import("~/server/repositories/portfolio.server");
  route = await import("~/routes/portfolio.$id.rehearsal");
  const exceptions = await import("~/server/repositories/exceptions.server");
  await exceptions.setException("teacher-a", exceptions.featureKey("portfolio"), "on");
  ownId = (await repo.createDossier("teacher-a", "Mijn BDB", sampleDossier())).id;
  foreignId = (await repo.createDossier("teacher-b", "Andere", sampleDossier())).id;
});

beforeEach(() => {
  currentUser.value = { id: "teacher-a", name: "A", email: null, role: "teacher" } as never;
});

const get = (id: string) =>
  route.loader({
    request: new Request(`http://localhost/portfolio/${id}/rehearsal`),
    params: { id },
  } as never);

function keep(id: string, fields: Record<string, string>) {
  const body = new URLSearchParams({ intent: "keepRehearsal", ...fields });
  const request = new Request(`http://localhost/portfolio/${id}/rehearsal`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: body.toString(),
  });
  return route.action({ request, params: { id } } as never);
}

async function status(p: Promise<unknown>) {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}

const answer = (quote: string) =>
  JSON.stringify({
    criteria: [{ key: "K1", heard: "convincing", quote, tip: "Noem ook het effect." }],
    overall: "Een helder gesprek.",
  });
const turns = JSON.stringify(["Ik ben er klaar voor.", "Ik begon met een vraag uit hun stage."]);

describe("/portfolio/:id/rehearsal", () => {
  it("is a route of the workplace", () => {
    expect(flatRoutes().map((r) => r.path)).toContain("/portfolio/:id/rehearsal");
  });

  it("is only for the owner; anyone else gets a 404", async () => {
    expect(await status(get(foreignId))).toBe(404);
    expect(await status(get("unknown"))).toBe(404);
    currentUser.value = { id: "teacher-z", name: "Z", email: null, role: "teacher" } as never;
    expect(await status(get(ownId))).toBe(404);
  });

  it("offers the dossier's outcomes and the rehearsal tool, but no chapter text", async () => {
    const data = (await get(ownId)) as Awaited<ReturnType<typeof route.loader>>;
    expect(data.tool.slug).toBe("portfolio-rehearsal");
    expect(data.framework.outcomes.map((o) => o.id)).toEqual([LU]);
    expect(JSON.stringify(data)).not.toContain("Mijn les begon met een vraag.");
  });

  it("keeps the checked feedback as an evidence item and logs it", async () => {
    const r = await keep(ownId, {
      raw: answer("Ik begon met een vraag uit hun stage."),
      userTurns: turns,
      outcomeIds: JSON.stringify([LU]),
      model: "claude-sonnet-5-5",
    });
    expect(r).toMatchObject({ ok: true, intent: "keepRehearsal" });
    const d = (await repo.getDossier("teacher-a", ownId))!.data;
    const ev = d.evidence.at(-1)!;
    expect(ev.kind).toBe("feedback");
    expect(ev.criterionIds).toEqual([]);
    expect(ev.title).toMatch(/^Proefassessment, /);
    expect(ev.text).toContain("Ik begon met een vraag uit hun stage.");
    expect(d.aiLog.at(-1)).toMatchObject({ action: "rehearsal", model: "claude-sonnet-5-5" });
  });

  it("re-checks on the server: a quote the teacher never typed is not kept", async () => {
    await keep(ownId, {
      raw: answer("Ik gebruikte altijd rubrics."),
      userTurns: turns,
      outcomeIds: JSON.stringify([LU]),
      model: "claude-sonnet-5-5",
    });
    const ev = (await repo.getDossier("teacher-a", ownId))!.data.evidence.at(-1)!;
    expect(ev.text).not.toContain("rubrics");
    expect(ev.text).toContain("Deels");
    expect(ev.text).toContain(
      sampleDossier().framework.outcomes[0].criteria.find((c) => c.id === C1)!.text,
    );
  });

  it("refuses an answer that is not feedback, and a foreign dossier", async () => {
    const r = await keep(ownId, {
      raw: "Goed gedaan!",
      userTurns: turns,
      outcomeIds: "[]",
      model: "x",
    });
    expect(r).toMatchObject({ ok: false });
    expect(
      await status(
        keep(foreignId, { raw: answer("x"), userTurns: turns, outcomeIds: "[]", model: "x" }),
      ),
    ).toBe(404);
  });
});
