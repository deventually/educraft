import { beforeAll, describe, expect, it } from "vitest";
import { alignedCourse, ACT1, TEST1 } from "../courses/fixtures";
import { emptyCourseData } from "~/lib/courses/schema";

process.env.DATABASE_URL = "file::memory:";

type Repo = typeof import("~/server/repositories/courses.server");
let repo: Repo;
let users: typeof import("~/server/repositories/users.server");
let gens: typeof import("~/server/repositories/generations.server");
let profiles: typeof import("~/server/repositories/profiles.server");

const A = "courses-user-a";
const B = "courses-user-b";

beforeAll(async () => {
  repo = await import("~/server/repositories/courses.server");
  users = await import("~/server/repositories/users.server");
  gens = await import("~/server/repositories/generations.server");
  profiles = await import("~/server/repositories/profiles.server");
});

const generation = (userId: string) =>
  gens.saveGeneration({
    userId,
    toolSlug: "authentic-assessment",
    model: "test",
    input: {},
    outputLanguage: "nl",
    outputMarkdown: "# Toets",
  });

describe("courses repository", () => {
  it("round-trips create, get, update and delete", async () => {
    const created = await repo.createCourse(A, { name: "Software Engineering — jaar 2" });
    expect(created.data).toEqual(emptyCourseData());
    expect(created.contextProfileId).toBeNull();

    const updated = await repo.updateCourse(A, created.id, {
      name: "SE jaar 2",
      data: alignedCourse(),
    });
    expect(updated?.name).toBe("SE jaar 2");
    expect((await repo.getCourse(A, created.id))?.data).toEqual(alignedCourse());

    expect(await repo.deleteCourse(A, created.id)).toBe(true);
    expect(await repo.getCourse(A, created.id)).toBeNull();
  });

  it("stores the caller's own context profile, never someone else's", async () => {
    const mine = await profiles.createProfile(A, { name: "Profiel A" });
    const theirs = await profiles.createProfile(B, { name: "Profiel B" });
    const c = await repo.createCourse(A, { name: "Met profiel", contextProfileId: mine.id });
    expect(c.contextProfileId).toBe(mine.id);
    await expect(
      repo.createCourse(A, { name: "Vreemd profiel", contextProfileId: theirs.id }),
    ).rejects.toThrow();
    await expect(repo.updateCourse(A, c.id, { contextProfileId: theirs.id })).rejects.toThrow();
    expect((await repo.updateCourse(A, c.id, { contextProfileId: null }))?.contextProfileId).toBe(
      null,
    );
  });

  it("scopes every call to the owner", async () => {
    const mine = await repo.createCourse(A, { name: "Van A" });
    expect(await repo.getCourse(B, mine.id)).toBeNull();
    expect(await repo.updateCourse(B, mine.id, { name: "gekaapt" })).toBeNull();
    expect(await repo.deleteCourse(B, mine.id)).toBe(false);
    expect((await repo.listCourses(B)).map((c) => c.id)).not.toContain(mine.id);
    expect((await repo.getCourse(A, mine.id))?.name).toBe("Van A");
  });

  it("refuses invalid data and writes nothing", async () => {
    const c = await repo.createCourse(A, { name: "Geldig", data: alignedCourse() });
    const bad = alignedCourse();
    bad.activities[0]!.outcomeIds = ["onbekend"];
    await expect(repo.updateCourse(A, c.id, { data: bad })).rejects.toThrow();
    await expect(repo.createCourse(A, { name: "Fout", data: bad })).rejects.toThrow();
    expect((await repo.getCourse(A, c.id))?.data).toEqual(alignedCourse());
    await expect(repo.createCourse(A, { name: " " })).rejects.toThrow();
    await expect(repo.createCourse(A, { name: "x".repeat(201) })).rejects.toThrow();
  });

  it("caps the list and orders newest first", async () => {
    expect(await repo.listCourses(A, 1)).toHaveLength(1);
    const times = (await repo.listCourses(A)).map((c) => c.updatedAt.getTime());
    expect([...times].sort((x, y) => y - x)).toEqual(times);
  });
});

describe("course links", () => {
  it("links the caller's own generation, optionally to an item, and re-linking upserts", async () => {
    const c = await repo.createCourse(A, { name: "Koppelen", data: alignedCourse() });
    const g = await generation(A);
    const first = await repo.linkGeneration(A, c.id, g.id);
    expect(first?.itemId).toBeNull();
    const again = await repo.linkGeneration(A, c.id, g.id, TEST1);
    expect(again?.itemId).toBe(TEST1);
    const links = await repo.listLinksForCourse(A, c.id);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ courseId: c.id, generationId: g.id, itemId: TEST1 });
    expect((await repo.listCourseLinksForUser(A)).map((l) => l.generationId)).toContain(g.id);
  });

  it("refuses someone else's course or generation, and an unknown item", async () => {
    const mine = await repo.createCourse(A, { name: "Eigen", data: alignedCourse() });
    const theirs = await repo.createCourse(B, { name: "Andermans" });
    const myGen = await generation(A);
    const theirGen = await generation(B);
    expect(await repo.linkGeneration(A, mine.id, theirGen.id)).toBeNull();
    expect(await repo.linkGeneration(A, theirs.id, myGen.id)).toBeNull();
    expect(await repo.linkGeneration(A, mine.id, myGen.id, "onbekend")).toBeNull();
    expect(await repo.linkGeneration(A, "bestaat-niet", myGen.id)).toBeNull();
    expect(await repo.listLinksForCourse(A, mine.id)).toEqual([]);
    expect(await repo.listLinksForCourse(B, theirs.id)).toEqual([]);
  });

  it("unlinks, scoped to the owner", async () => {
    const c = await repo.createCourse(A, { name: "Ontkoppelen" });
    const g = await generation(A);
    await repo.linkGeneration(A, c.id, g.id);
    expect(await repo.unlinkGeneration(B, c.id, g.id)).toBe(false);
    expect(await repo.unlinkGeneration(A, c.id, g.id)).toBe(true);
    expect(await repo.listLinksForCourse(A, c.id)).toEqual([]);
  });

  it("clears a link's item when the item leaves the course", async () => {
    const c = await repo.createCourse(A, { name: "Item weg", data: alignedCourse() });
    const g = await generation(A);
    await repo.linkGeneration(A, c.id, g.id, ACT1);
    const next = alignedCourse();
    next.activities = next.activities.filter((a) => a.id !== ACT1);
    await repo.updateCourse(A, c.id, { data: next });
    const [link] = await repo.listLinksForCourse(A, c.id);
    expect(link!.generationId).toBe(g.id);
    expect(link!.itemId).toBeNull();
  });

  it("deleteCourse and deleteGeneration drop the links", async () => {
    const c = await repo.createCourse(A, { name: "Weg" });
    const g1 = await generation(A);
    const g2 = await generation(A);
    await repo.linkGeneration(A, c.id, g1.id);
    const other = await repo.createCourse(A, { name: "Blijft" });
    await repo.linkGeneration(A, other.id, g2.id);

    await gens.deleteGeneration(A, g2.id);
    expect(await repo.listLinksForCourse(A, other.id)).toEqual([]);

    await repo.deleteCourse(A, c.id);
    expect((await repo.listCourseLinksForUser(A)).map((l) => l.courseId)).not.toContain(c.id);
  });

  it("deleteUserCascade removes courses and links", async () => {
    const c = await repo.createCourse(B, { name: "Weg met B" });
    const g = await generation(B);
    await repo.linkGeneration(B, c.id, g.id);
    await users.deleteUserCascade(B);
    expect(await repo.getCourse(B, c.id)).toBeNull();
    expect(await repo.listCourseLinksForUser(B)).toEqual([]);
  });

  it("caps the link lists", async () => {
    const c = await repo.createCourse(A, { name: "Veel" });
    for (let i = 0; i < 3; i++) await repo.linkGeneration(A, c.id, (await generation(A)).id);
    expect(await repo.listLinksForCourse(A, c.id, 2)).toHaveLength(2);
    expect(await repo.listCourseLinksForUser(A, 2)).toHaveLength(2);
  });

  it("lists the linked work of a course with its tool and date, owner-scoped (20.4)", async () => {
    const c = await repo.createCourse(A, { name: "Gekoppeld", data: alignedCourse() });
    const g = await generation(A);
    await repo.linkGeneration(A, c.id, g.id, TEST1);
    const work = await repo.listLinkedWork(A, c.id);
    expect(work).toEqual([
      {
        generationId: g.id,
        toolSlug: "authentic-assessment",
        itemId: TEST1,
        createdAt: g.createdAt,
      },
    ]);
    expect(await repo.listLinkedWork(B, c.id)).toEqual([]);
  });
});
