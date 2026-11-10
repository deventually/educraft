import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { C1, LU, sampleDossier } from "../portfolio/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let toolRoute: typeof import("~/routes/tool");
let projects: typeof import("~/routes/projects._index");
let generations: typeof import("~/server/repositories/generations.server");
let portfolio: typeof import("~/server/repositories/portfolio.server");
let exceptions: typeof import("~/server/repositories/exceptions.server");

beforeAll(async () => {
  toolRoute = await import("~/routes/tool");
  projects = await import("~/routes/projects._index");
  generations = await import("~/server/repositories/generations.server");
  portfolio = await import("~/server/repositories/portfolio.server");
  exceptions = await import("~/server/repositories/exceptions.server");
});

const as = (id: string) => signInAs({ id });
beforeEach(() => as("td-a"));

interface ForCriterion {
  dossierId: string;
  dossierName: string;
  outcomeId: string;
  outcomeLabel: string;
  criterionId: string;
  criterionText: string;
}
interface Loaded {
  dossiers: unknown[];
  forCriterion: ForCriterion | null;
}

const load = (query = "", slug = "authentic-assessment") =>
  toolRoute.loader({
    request: signedRequest(`http://localhost/tools/${slug}${query}`),
    params: { slug },
    context: {},
  } as never) as Promise<Loaded>;

function act(fields: Record<string, string>, slug = "authentic-assessment") {
  const request = signedRequest(`http://localhost/tools/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: new URLSearchParams(fields).toString(),
  });
  return toolRoute.action({ request, params: { slug }, context: {} } as never);
}

const generation = (userId: string) =>
  generations.saveGeneration({
    userId,
    toolSlug: "authentic-assessment",
    input: {},
    outputMarkdown: "# Toets",
    model: "test",
    outputLanguage: "nl",
  } as never);

describe("from a criterion to the tool and back (P27.2)", () => {
  it("shows the dossier bar only for the teacher's own dossier and criterion", async () => {
    const mine = await portfolio.createDossier("td-a", "Mijn BDB", sampleDossier());
    const theirs = await portfolio.createDossier("td-b", "Hun BDB", sampleDossier());
    const own = await load(`?dossier=${mine.id}&criterion=${C1}`);
    expect(own.forCriterion).toEqual({
      dossierId: mine.id,
      dossierName: "Mijn BDB",
      outcomeId: LU,
      outcomeLabel: "LU1 Doceren",
      criterionId: C1,
      criterionText: sampleDossier().framework.outcomes[0]!.criteria[0]!.text,
    });
    expect((await load(`?dossier=${theirs.id}&criterion=${C1}`)).forCriterion).toBeNull();
    expect((await load(`?dossier=${mine.id}&criterion=nope`)).forCriterion).toBeNull();
    expect((await load(`?dossier=bogus&criterion=${C1}`)).forCriterion).toBeNull();
    expect((await load()).forCriterion).toBeNull();
  });

  it("'Zet bij dit criterium' writes the evidence with its source generation", async () => {
    const mine = await portfolio.createDossier("td-a", "Mijn BDB", sampleDossier());
    const g = await generation("td-a");
    const r = await act({ intent: "addToDossier", id: g.id, dossierId: mine.id, criterionId: C1 });
    expect(r).toMatchObject({ ok: true });
    const evidence = (await portfolio.getDossier("td-a", mine.id))?.data.evidence ?? [];
    expect(evidence.at(-1)).toMatchObject({ criterionIds: [C1], sourceGenerationId: g.id });
  });
});

describe("workplace switched off (P27)", () => {
  it("hides the bar and the evidence choice, and refuses the action on both pages", async () => {
    await as("td-off");
    const mine = await portfolio.createDossier("td-off", "Mijn BDB", sampleDossier());
    await exceptions.setException("td-off", exceptions.featureKey("portfolio"), "off");
    const g = await generation("td-off");
    const data = await load(`?dossier=${mine.id}&criterion=${C1}`);
    expect(data.forCriterion).toBeNull();
    expect(data.dossiers).toEqual([]);
    const fields = { intent: "addToDossier", id: g.id, dossierId: mine.id, criterionId: C1 };
    expect(await act(fields)).toMatchObject({ ok: false });
    const viaProjects = await projects.action({
      request: signedRequest("http://localhost/projects", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
        body: new URLSearchParams(fields).toString(),
      }),
    } as never);
    expect(viaProjects).toMatchObject({ ok: false });
    expect((await portfolio.getDossier("td-off", mine.id))?.data.evidence).toHaveLength(1);
    const list = (await projects.loader({
      request: signedRequest("http://localhost/projects"),
    } as never)) as {
      dossiers: unknown[];
    };
    expect(list.dossiers).toEqual([]);
  });
});
