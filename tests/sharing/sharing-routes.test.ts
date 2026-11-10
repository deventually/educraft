import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { alignedCourse } from "../courses/fixtures";
import { sampleRubric } from "../utilities/fixtures";
import { flatRoutes } from "../helpers/routes";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const as = (id: string) => signInAs({ id });

let courses: typeof import("~/server/repositories/courses.server");
let rubrics: typeof import("~/server/repositories/rubrics.server");
let profiles: typeof import("~/server/repositories/profiles.server");
let shares: typeof import("~/server/repositories/shares.server");
let generations: typeof import("~/server/repositories/generations.server");
let courseList: typeof import("~/routes/courses._index");
let courseDetail: typeof import("~/routes/courses.$id");
let sharedCourse: typeof import("~/routes/courses.shared.$id");
let rubricList: typeof import("~/routes/utilities.rubric._index");
let rubricDetail: typeof import("~/routes/utilities.rubric.$id");
let sharedRubric: typeof import("~/routes/utilities.rubric.shared.$id");
let contextPage: typeof import("~/routes/context-profiles");
let team = "";

beforeAll(async () => {
  courses = await import("~/server/repositories/courses.server");
  rubrics = await import("~/server/repositories/rubrics.server");
  profiles = await import("~/server/repositories/profiles.server");
  shares = await import("~/server/repositories/shares.server");
  generations = await import("~/server/repositories/generations.server");
  courseList = await import("~/routes/courses._index");
  courseDetail = await import("~/routes/courses.$id");
  sharedCourse = await import("~/routes/courses.shared.$id");
  rubricList = await import("~/routes/utilities.rubric._index");
  rubricDetail = await import("~/routes/utilities.rubric.$id");
  sharedRubric = await import("~/routes/utilities.rubric.shared.$id");
  contextPage = await import("~/routes/context-profiles");
  const users = await import("~/server/repositories/users.server");
  const teams = await import("~/server/repositories/teams.server");
  for (const [id, name] of [
    ["share-a", "Anna"],
    ["share-b", "Bram"],
    ["share-c", "Cas"],
  ] as const)
    await users.createUser({ id, name, passwordHash: "x", role: "teacher" });
  team = (await teams.createTeam("Verpleegkunde")).id;
  await teams.addMember(team, "share-a");
  await teams.addMember(team, "share-b");
});

beforeEach(() => as("share-a"));

function post(path: string, fields: Record<string, string>): Request {
  return signedRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: new URLSearchParams(fields).toString(),
  });
}
const get = (path: string) => signedRequest(`http://localhost${path}`);

async function status(p: Promise<unknown>): Promise<number | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}

describe("routes (P28.4)", () => {
  it("registers the read-only pages for a shared course and rubric", () => {
    const paths = flatRoutes().map((r) => `${r.path} ${r.file}`);
    expect(paths).toContain("/courses/shared/:id routes/courses.shared.$id.tsx");
    expect(paths).toContain("/utilities/rubric/shared/:id routes/utilities.rubric.shared.$id.tsx");
  });
});

describe("a course, shared with the team", () => {
  it("is shared and unshared by its owner from the course page", async () => {
    const course = await courses.createCourse("share-a", {
      name: "Anatomie",
      data: alignedCourse(),
    });
    const act = (fields: Record<string, string>) =>
      courseDetail.action({
        request: post(`/courses/${course.id}`, fields),
        params: { id: course.id },
      } as never);

    const loaded = (await courseDetail.loader({
      request: get(`/courses/${course.id}`),
      params: { id: course.id },
    } as never)) as { sharing: { teams: { id: string; name: string }[]; sharedWith: string[] } };
    expect(loaded.sharing).toEqual({
      teams: [{ id: team, name: "Verpleegkunde" }],
      sharedWith: [],
    });

    expect(await act({ intent: "share", teamId: team })).toMatchObject({
      ok: true,
      intent: "share",
    });
    expect(await shares.listItemShares("share-a", "course", course.id)).toEqual([team]);
    expect(await act({ intent: "unshare", teamId: team })).toMatchObject({
      ok: true,
      intent: "unshare",
    });
    expect(await shares.listItemShares("share-a", "course", course.id)).toEqual([]);
  });

  it("refuses a team the owner is not in, and a colleague cannot share it", async () => {
    const course = await courses.createCourse("share-a", {
      name: "Fysiologie",
      data: alignedCourse(),
    });
    const r = await courseDetail.action({
      request: post(`/courses/${course.id}`, { intent: "share", teamId: "no-such-team" }),
      params: { id: course.id },
    } as never);
    expect(r).toMatchObject({ ok: false, intent: "share" });
    await as("share-b");
    expect(
      await status(
        courseDetail.action({
          request: post(`/courses/${course.id}`, { intent: "share", teamId: team }),
          params: { id: course.id },
        } as never),
      ),
    ).toBe(404);
  });

  it("shows under 'Van mijn team', opens read-only, hides student work, and copies", async () => {
    const course = await courses.createCourse("share-a", {
      name: "Farmacologie",
      data: alignedCourse(),
    });
    const save = (toolSlug: string) =>
      generations.saveGeneration({
        userId: "share-a",
        toolSlug,
        model: "m",
        input: {},
        outputLanguage: "nl",
        outputMarkdown: `uit ${toolSlug}`,
      });
    await courses.linkGeneration("share-a", course.id, (await save("lesson-plan")).id);
    await courses.linkGeneration("share-a", course.id, (await save("math-grading")).id);
    await shares.shareItem("share-a", "course", course.id, team);

    await as("share-b");
    const list = (await courseList.loader({ request: get("/courses") } as never)) as {
      shared: { id: string; name: string; ownerName: string }[];
    };
    expect(list.shared).toEqual([
      expect.objectContaining({ id: course.id, name: "Farmacologie", ownerName: "Anna" }),
    ]);

    const view = (await sharedCourse.loader({
      request: get(`/courses/shared/${course.id}`),
      params: { id: course.id },
    } as never)) as {
      course: { name: string; ownerName: string };
      work: { outputMarkdown: string }[];
    };
    expect(view.course).toMatchObject({ name: "Farmacologie", ownerName: "Anna" });
    expect(view.work.map((w) => w.outputMarkdown)).toEqual(["uit lesson-plan"]);

    const copied = await sharedCourse.action({
      request: post(`/courses/shared/${course.id}`, { intent: "copy" }),
      params: { id: course.id },
    } as never);
    expect(copied).toBeInstanceOf(Response);
    const copyId = ((copied as Response).headers.get("Location") ?? "").split("/").pop() ?? "";
    expect((await courses.getCourse("share-b", copyId))?.name).toBe("Farmacologie");

    await as("share-c");
    expect(
      await status(
        sharedCourse.loader({
          request: get(`/courses/shared/${course.id}`),
          params: { id: course.id },
        } as never),
      ),
    ).toBe(404);
  });
});

describe("a rubric, shared with the team", () => {
  it("is shared from its page, read-only for a colleague, and copied", async () => {
    const rubric = await rubrics.createRubric("share-a", "Verslag", sampleRubric());
    expect(
      await rubricDetail.action({
        request: post(`/utilities/rubric/${rubric.id}`, { intent: "share", teamId: team }),
        params: { id: rubric.id },
      } as never),
    ).toMatchObject({ ok: true, intent: "share" });

    await as("share-b");
    const list = (await rubricList.loader({ request: get("/utilities/rubric") } as never)) as {
      shared: { id: string; ownerName: string }[];
    };
    expect(list.shared.map((s) => s.ownerName)).toEqual(["Anna"]);
    const view = (await sharedRubric.loader({
      request: get(`/utilities/rubric/shared/${rubric.id}`),
      params: { id: rubric.id },
    } as never)) as { rubric: { name: string } };
    expect(view.rubric.name).toBe("Verslag");
    const copied = (await sharedRubric.action({
      request: post(`/utilities/rubric/shared/${rubric.id}`, { intent: "copy" }),
      params: { id: rubric.id },
    } as never)) as Response;
    const copyId = (copied.headers.get("Location") ?? "").split("/").pop() ?? "";
    expect((await rubrics.getRubric("share-b", copyId))?.name).toBe("Verslag");
    // Editing stays the owner's: the colleague's own rubric page is a 404 for this id.
    expect(
      await status(
        rubricDetail.loader({
          request: get(`/utilities/rubric/${rubric.id}`),
          params: { id: rubric.id },
        } as never),
      ),
    ).toBe(404);
  });
});

describe("a context profile, shared with the team", () => {
  it("is shared from the context page and copied by a colleague", async () => {
    const profile = await profiles.createProfile("share-a", { name: "Verpleegkunde jaar 1" });
    expect(
      await contextPage.action({
        request: post("/context-profiles", { intent: "share", id: profile.id, teamId: team }),
      } as never),
    ).toMatchObject({ ok: true, intent: "share" });

    await as("share-b");
    const page = (await contextPage.loader({ request: get("/context-profiles") } as never)) as {
      shared: { id: string; name: string; ownerName: string }[];
    };
    expect(page.shared).toEqual([
      expect.objectContaining({ id: profile.id, name: "Verpleegkunde jaar 1", ownerName: "Anna" }),
    ]);
    expect(
      await contextPage.action({
        request: post("/context-profiles", { intent: "copy-shared", id: profile.id }),
      } as never),
    ).toMatchObject({ ok: true, intent: "copy-shared" });
    expect((await profiles.listProfiles("share-b")).map((p) => p.name)).toEqual([
      "Verpleegkunde jaar 1",
    ]);
    // A colleague cannot share someone else's profile.
    expect(
      await contextPage.action({
        request: post("/context-profiles", { intent: "share", id: profile.id, teamId: team }),
      } as never),
    ).toMatchObject({ ok: false });
  });
});

describe("never shareable", () => {
  it("the dossier and rubric fill-ins have no share action", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of [
      "app/routes/portfolio.$id.tsx",
      "app/routes/portfolio._index.tsx",
      "app/routes/utilities.rubric.$id.fill.tsx",
    ])
      expect(readFileSync(file, "utf8")).not.toMatch(/ShareWithTeam|shareAction/);
  });
});
