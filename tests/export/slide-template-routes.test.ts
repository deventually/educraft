import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { flatRoutes } from "../helpers/routes";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

/** P30.7b: uploading a PowerPoint template, for oneself and as a team's lead. */
let own: typeof import("~/routes/account.slide-template");
let team: typeof import("~/routes/teams.$id.slide-template");
let repo: typeof import("~/server/repositories/slideTemplates.server");
let teamId = "";
const school = readFileSync("tests/fixtures/template-school.pptx");

beforeAll(async () => {
  own = await import("~/routes/account.slide-template");
  team = await import("~/routes/teams.$id.slide-template");
  repo = await import("~/server/repositories/slideTemplates.server");
  const users = await import("~/server/repositories/users.server");
  const teams = await import("~/server/repositories/teams.server");
  for (const id of ["up-lead", "up-member"])
    await users.createUser({ id, name: id, passwordHash: "x", role: "teacher" });
  teamId = (await teams.createTeam("Biologie")).id;
  await teams.addMember(teamId, "up-lead");
  await teams.addMember(teamId, "up-member");
  await teams.setLead(teamId, "up-lead", true);
});

function form(intent: string, file?: { name: string; bytes: Uint8Array | Buffer }) {
  const fd = new FormData();
  fd.set("intent", intent);
  if (file) fd.set("file", new File([new Uint8Array(file.bytes)], file.name));
  return fd;
}
const post = (path: string, body: FormData) =>
  signedRequest(`http://localhost${path}`, { method: "POST", body });

const upload = (body: FormData) =>
  own.action({ request: post("/account/slide-template", body), params: {} } as never) as Promise<
    Record<string, unknown>
  >;
const uploadTeam = (body: FormData) =>
  team.action({
    request: post(`/teams/${teamId}/slide-template`, body),
    params: { id: teamId },
  } as never) as Promise<Record<string, unknown>>;

describe("PowerPoint template upload (P30.7b)", () => {
  it("registers both upload routes", () => {
    const paths = flatRoutes().map((r) => r.path);
    expect(paths).toContain("/account/slide-template");
    expect(paths).toContain("/teams/:id/slide-template");
  });

  it("saves a teacher's own .pptx and removes it again", async () => {
    await signInAs({ id: "up-member" });
    expect(await upload(form("upload", { name: "Hogeschool.pptx", bytes: school }))).toEqual({
      ok: "saved",
      name: "Hogeschool.pptx",
    });
    expect((await repo.listTemplatesForUser("up-member")).map((t) => t.name)).toEqual([
      "Hogeschool.pptx",
    ]);
    expect(await upload(form("delete"))).toEqual({ ok: "deleted" });
    expect(await repo.listTemplatesForUser("up-member")).toEqual([]);
  });

  it("refuses a file that is not a PowerPoint template, saying why", async () => {
    await signInAs({ id: "up-member" });
    expect(await upload(form("upload"))).toEqual({ error: "noFile" });
    expect(await upload(form("upload", { name: "notities.txt", bytes: school }))).toEqual({
      error: "wrongType",
    });
    const docx = readFileSync("tests/fixtures/sample.docx");
    expect(await upload(form("upload", { name: "nep.pptx", bytes: docx }))).toEqual({
      error: "notPowerPoint",
    });
    expect(await upload(form("nonsense"))).toEqual({ error: "noFile" });
    expect(await repo.listTemplatesForUser("up-member")).toEqual([]);
  });

  it("refuses a body that announces more than the limit, before reading it", async () => {
    await signInAs({ id: "up-member" });
    const request = signedRequest("http://localhost/account/slide-template", {
      method: "POST",
      body: form("upload", { name: "groot.pptx", bytes: school }),
    });
    const big = new Request(request, {
      headers: {
        ...Object.fromEntries(request.headers),
        "content-length": String(50 * 1024 * 1024),
      },
    });
    expect(await own.action({ request: big, params: {} } as never)).toEqual({ error: "tooLarge" });
  });

  it("lets the team's lead set the team's template, which every member then has", async () => {
    await signInAs({ id: "up-lead" });
    expect(
      await uploadTeam(
        form("upload", {
          name: "Team.potx",
          bytes: readFileSync("tests/fixtures/template-school.potx"),
        }),
      ),
    ).toEqual({
      ok: "saved",
      name: "Team.potx",
    });
    const forMember = await repo.listTemplatesForUser("up-member");
    expect(forMember).toEqual([
      expect.objectContaining({ name: "Team.potx", scope: "team", teamName: "Biologie" }),
    ]);
  });

  it("is a 404 for a member who is not the lead", async () => {
    await signInAs({ id: "up-member" });
    await expect(uploadTeam(form("delete"))).rejects.toMatchObject({ status: 404 });
    expect(await repo.listTemplatesForUser("up-member")).toHaveLength(1);
  });
});

describe("the pages that show the template (P30.7b)", () => {
  const load = async (path: string, params: Record<string, string>) => {
    const route =
      path === "/account" ? await import("~/routes/account") : await import("~/routes/teams.$id");
    return (await route.loader({
      request: signedRequest(`http://localhost${path}`),
      params,
    } as never)) as { slideTemplate: { name: string } | null };
  };

  it("shows a teacher their own template on the account page", async () => {
    await signInAs({ id: "up-member" });
    expect((await load("/account", {})).slideTemplate).toBeNull();
    await upload(form("upload", { name: "Eigen.pptx", bytes: school }));
    expect((await load("/account", {})).slideTemplate).toEqual(
      expect.objectContaining({ name: "Eigen.pptx" }),
    );
  });

  it("shows the lead the team's template on the team page", async () => {
    await signInAs({ id: "up-lead" });
    expect((await load(`/teams/${teamId}`, { id: teamId })).slideTemplate).toEqual(
      expect.objectContaining({ name: "Team.potx" }),
    );
  });
});
