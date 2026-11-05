import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleDossier } from "../portfolio/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { currentUser } = vi.hoisted(() => ({ currentUser: { value: null as unknown } }));
vi.mock("~/server/auth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/auth.server")>();
  return {
    ...actual,
    requireUser: vi.fn(async () => currentUser.value),
    requireRole: vi.fn(async () => currentUser.value),
    getUser: vi.fn(async () => currentUser.value),
  };
});
vi.mock("~/lib/ai/discover.server", () => ({ discoverLocalModels: vi.fn(async () => []) }));

let av: typeof import("~/server/availability.server");
let teams: typeof import("~/server/repositories/teams.server");
let users: typeof import("~/server/repositories/users.server");
let settings: typeof import("~/server/repositories/settings.server");
let exceptions: typeof import("~/server/repositories/exceptions.server");
let portfolio: typeof import("~/server/repositories/portfolio.server");
let access: typeof import("~/server/portfolioAccess.server");
let toolRoute: typeof import("~/routes/tool");
let registry: typeof import("~/lib/registry");

beforeAll(async () => {
  av = await import("~/server/availability.server");
  teams = await import("~/server/repositories/teams.server");
  users = await import("~/server/repositories/users.server");
  settings = await import("~/server/repositories/settings.server");
  exceptions = await import("~/server/repositories/exceptions.server");
  portfolio = await import("~/server/repositories/portfolio.server");
  access = await import("~/server/portfolioAccess.server");
  toolRoute = await import("~/routes/tool");
  registry = await import("~/lib/registry");
});

const TOOL = "math-grading";
let n = 0;
async function teacher() {
  n++;
  return users.createUser({ name: `T${n}`, passwordHash: "scrypt:a:b", role: "teacher" });
}
async function teamWith(
  member: { id: string },
  choices: Parameters<typeof teams.setTeamSettings>[1],
) {
  const team = await teams.createTeam(`Team ${++n}`);
  await teams.addMember(team.id, member.id);
  await teams.setTeamSettings(team.id, choices);
  return team;
}
const none = { features: {}, tools: {}, models: null };
const tool = () => registry.ALL_TOOLS.find((t) => t.slug === TOOL)!;
async function status(p: Promise<unknown>) {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}

beforeEach(async () => {
  await settings.setToolStand(TOOL, null);
  await settings.setFeatureStand("portfolio", "request");
});

describe("tools follow the three layers (P28.3)", () => {
  it("On request: only a member of a team that switches it on sees it; others get a 404", async () => {
    await settings.setToolStand(TOOL, "request");
    const inTeam = await teacher();
    const other = await teacher();
    await teamWith(inTeam, { ...none, tools: { [TOOL]: "on" } });
    expect(await av.isToolAvailable(inTeam, tool())).toBe(true);
    expect(await av.isToolAvailable(other, tool())).toBe(false);
    expect((await av.getAvailableTools(other)).map((t) => t.slug)).not.toContain(TOOL);
    currentUser.value = other;
    expect(
      await status(
        toolRoute.loader({
          request: new Request(`http://localhost/tools/${TOOL}`),
          params: { slug: TOOL },
        } as never),
      ),
    ).toBe(404);
  });

  it("a team saying off hides a default-on tool; another team saying on wins", async () => {
    const t = await teacher();
    await teamWith(t, { ...none, tools: { [TOOL]: "off" } });
    expect(await av.isToolAvailable(t, tool())).toBe(false);
    await teamWith(t, { ...none, tools: { [TOOL]: "on" } });
    expect(await av.isToolAvailable(t, tool())).toBe(true);
  });

  it("an exception wins over teams; instance Off wins over everything", async () => {
    const t = await teacher();
    await teamWith(t, { ...none, tools: { [TOOL]: "on" } });
    await exceptions.setException(t.id, exceptions.toolKey(TOOL), "off");
    expect(await av.isToolAvailable(t, tool())).toBe(false);
    await exceptions.setException(t.id, exceptions.toolKey(TOOL), "on");
    await settings.setToolStand(TOOL, "off");
    expect(await av.isToolAvailable(t, tool())).toBe(false);
  });

  it("an admin sees every tool the instance has not Off", async () => {
    const admin = await users.createUser({ name: "A", passwordHash: "x", role: "admin" });
    await settings.setToolStand(TOOL, "request");
    expect(await av.isToolAvailable(admin, tool())).toBe(true);
    await settings.setToolStand(TOOL, "off");
    expect(await av.isToolAvailable(admin, tool())).toBe(false);
  });

  it("a lead cannot switch on what the instance has Off", async () => {
    await settings.setToolStand(TOOL, "off");
    const lead = await teacher();
    const team = await teams.createTeam("Lead team");
    await teams.addMember(team.id, lead.id);
    await teams.setLead(team.id, lead.id, true);
    await teams.leadSetSettings(lead.id, team.id, { ...none, tools: { [TOOL]: "on" } });
    expect(await av.isToolAvailable(lead, tool())).toBe(false);
  });
});

describe("effectiveFeatures and where a stand comes from (P28.3)", () => {
  it("names the source: instance default, team, exception", async () => {
    const t = await teacher();
    expect((await av.effectiveFeatures(t)).courses).toEqual({ on: true, source: "default" });
    const team = await teamWith(t, { ...none, features: { courses: "off" } });
    expect((await av.effectiveFeatures(t)).courses).toEqual({
      on: false,
      source: "team",
      team: team.name,
    });
    await exceptions.setException(t.id, exceptions.featureKey("courses"), "on");
    expect((await av.effectiveFeatures(t)).courses).toEqual({ on: true, source: "exception" });
  });
});

describe("BDB/BKE through the rule (P28.3)", () => {
  it("team on → on; the teacher's exception off wins; the dossier survives", async () => {
    const t = await teacher();
    expect(await access.portfolioAccess(t)).toBe(false);
    await teamWith(t, { ...none, features: { portfolio: "on" } });
    expect(await access.portfolioAccess(t)).toBe(true);
    const d = await portfolio.createDossier(t.id, "Mijn BDB", sampleDossier());
    await exceptions.setException(t.id, exceptions.featureKey("portfolio"), "off");
    expect(await access.portfolioAccess(t)).toBe(false);
    await exceptions.setException(t.id, exceptions.featureKey("portfolio"), null);
    expect(await access.portfolioAccess(t)).toBe(true);
    expect((await portfolio.listDossiers(t.id)).map((x) => x.id)).toContain(d.id);
  });

  it("an admin always has it; a teacher with a dossier and no choice keeps it", async () => {
    const admin = await users.createUser({ name: "A2", passwordHash: "x", role: "admin" });
    expect(await access.portfolioAccess(admin)).toBe(true);
    const old = await teacher();
    await portfolio.createDossier(old.id, "Oud", sampleDossier());
    expect(await access.portfolioAccess(old)).toBe(true);
  });

  it("instance Off is off, even with a dossier", async () => {
    const old = await teacher();
    await portfolio.createDossier(old.id, "Oud", sampleDossier());
    await settings.setFeatureStand("portfolio", "off");
    expect(await access.portfolioAccess(old)).toBe(false);
  });
});

describe("models per team (P28.3)", () => {
  it("own set → union of the team sets → instance, always within the instance", async () => {
    await settings.setEnabledModels(["claude-sonnet-4-6", "claude-haiku-4-5"]);
    const t = await teacher();
    expect([...(await av.getSelectableModelIds(t))].sort()).toEqual(
      ["claude-haiku-4-5", "claude-sonnet-4-6"].sort(),
    );
    await teamWith(t, { ...none, models: ["claude-haiku-4-5"] });
    expect([...(await av.getSelectableModelIds(t))]).toEqual(["claude-haiku-4-5"]);
    expect(await av.isModelSelectableForUser(t, "claude-sonnet-4-6")).toBe(false);
    // A team set outside the instance counts for nothing: back to the instance.
    const u = await teacher();
    await teamWith(u, { ...none, models: ["claude-opus-4-8"] });
    expect([...(await av.getSelectableModelIds(u))].sort()).toEqual(
      ["claude-haiku-4-5", "claude-sonnet-4-6"].sort(),
    );
    // The teacher's own set (P18) still replaces everything.
    await users.setUserAssignedModels(t.id, ["claude-sonnet-4-6"]);
    expect([...(await av.getSelectableModelIds(t))]).toEqual(["claude-sonnet-4-6"]);
    await settings.setEnabledModels(null);
  });
});

describe("a part that is off is a 404, and the menu leaves it out (P28.3)", () => {
  const get = (path: string) => new Request(`http://localhost${path}`);
  beforeEach(async () => {
    await settings.setFeatureStand("courses", "on");
    await settings.setFeatureStand("utilities", "on");
  });

  it("courses: the list and its actions follow the team", async () => {
    const courses = await import("~/routes/courses._index");
    const course = await import("~/routes/courses.$id");
    const root = await import("~/root");
    const t = await teacher();
    currentUser.value = t;
    expect(await status(courses.loader({ request: get("/courses") } as never))).toBeUndefined();
    expect((await root.loader({ request: get("/") } as never)).data.user?.features.courses).toBe(
      true,
    );
    await teamWith(t, { ...none, features: { courses: "off" } });
    expect(await status(courses.loader({ request: get("/courses") } as never))).toBe(404);
    expect(
      await status(course.loader({ request: get("/courses/x"), params: { id: "x" } } as never)),
    ).toBe(404);
    expect((await root.loader({ request: get("/") } as never)).data.user?.features.courses).toBe(
      false,
    );
  });

  it("utilities: the pages are a 404 and the home page has no section", async () => {
    const utilities = await import("~/routes/utilities._index");
    const rubric = await import("~/routes/utilities.rubric._index");
    const home = await import("~/routes/home");
    const t = await teacher();
    currentUser.value = t;
    expect((await home.loader({ request: get("/") } as never)).utilities).toBe(true);
    await settings.setFeatureStand("utilities", "off");
    expect(await status(utilities.loader({ request: get("/utilities") } as never))).toBe(404);
    expect(await status(rubric.loader({ request: get("/utilities/rubric") } as never))).toBe(404);
    expect((await home.loader({ request: get("/") } as never)).utilities).toBe(false);
  });
});
